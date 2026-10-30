import {
  CATEGORIES,
  type Category,
  type CategoryUsage,
  type ItemSummary,
} from "../shared/types.ts";

/** 桌面地图：25 列 × 8 行。 */
export const MAP_COLUMNS = 25;
export const MAP_ROWS = 8;
/** 窄视口地图：20 列 × 10 行。两套断点都是 200 格，布局只改列数。 */
export const COMPACT_COLUMNS = 20;
export const COMPACT_ROWS = 10;
/** 格子总数；地图表达分母，已用之外的格子留空。 */
export const MAP_CELLS = MAP_COLUMNS * MAP_ROWS;

const EPSILON = 1e-9;
const MIN_FIT_DENOMINATOR = 10_000;
const FIT_HEADROOM = 1.15;

export interface MapSegment {
  category: Category;
  /** 该分类落在这一格里的 token 数，可能是小数。 */
  tokens: number;
  /** 在格子内的起点，0..1。 */
  from: number;
  /** 在格子内的终点，0..1。 */
  to: number;
}

export interface MapCell {
  index: number;
  segments: MapSegment[];
  /** 占比最大的分类；空格子为 free。 */
  primary: Category | "free";
  /** 整格都是 Free space。 */
  free: boolean;
}

export interface MapLayout {
  cells: MapCell[];
  /** 已用 token 总数，即所有非空分类之和。 */
  total: number;
  /** 地图分母；用于图例与空格子的 token 说明。 */
  denominator: number;
  /** 每个分类覆盖的格子下标，用于点选分类后的高亮；不包含 free。 */
  cellsByCategory: Record<Category, number[]>;
}

export interface GradientStop {
  category: Category;
  /** 停靠点起点，0..100。 */
  start: number;
  /** 停靠点终点，0..100。 */
  end: number;
}

export interface WindowBarState {
  used: number;
  window: number;
  /** 已用占窗口的比例，封顶 1。 */
  fraction: number;
  /** Free space；Used 超过 Window 时为 0。 */
  free: number;
  over: boolean;
}

export interface CategoryBreakdownRow {
  kind: "category";
  category: Category;
  items: number;
  tokens: number;
}

export interface FreeBreakdownRow {
  kind: "free";
  tokens: number;
}

export interface Breakdown {
  rows: CategoryBreakdownRow[];
  free: FreeBreakdownRow;
}

function emptyCellsByCategory(): Record<Category, number[]> {
  const result = {} as Record<Category, number[]>;
  for (const category of CATEGORIES) result[category] = [];
  return result;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function positiveTokens(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * 把已用分类铺到分母对应的格子上，剩余格子留空。
 *
 * 先用 Used / denominator 决定占用多少整格，再在占用格内按分类比例铺开；
 * 分类边界落在格子内部时，这一格会产生多个 segment，由面板渲染成渐变。
 * 返回全部 cellCount 个位置，空格子的 `primary` 为 free。
 */
export function layoutMap(
  categories: readonly CategoryUsage[],
  denominator: number,
  cellCount: number = MAP_CELLS,
): MapLayout {
  const cellsByCategory = emptyCellsByCategory();
  const usage = new Map<Category, CategoryUsage>();
  for (const entry of categories) {
    usage.set(entry.category, entry);
  }

  const spans: Array<{ category: Category; tokens: number; start: number; end: number }> = [];
  let total = 0;
  for (const category of CATEGORIES) {
    const tokens = positiveTokens(usage.get(category)?.tokens);
    if (tokens <= 0) continue;
    spans.push({ category, tokens, start: total, end: total + tokens });
    total += tokens;
  }

  if (cellCount <= 0) {
    return { cells: [], total, denominator: positiveTokens(denominator), cellsByCategory };
  }

  const safeDenominator = positiveTokens(denominator) || total;
  const usedCells = total <= 0 || safeDenominator <= 0
    ? 0
    : Math.min(cellCount, Math.max(1, Math.round((total / safeDenominator) * cellCount)));

  const cells: MapCell[] = [];
  const size = usedCells > 0 ? total / usedCells : 0;

  for (let index = 0; index < usedCells; index += 1) {
    const start = index * size;
    const end = (index + 1) * size;
    const segments: MapSegment[] = [];

    for (const span of spans) {
      if (span.end <= start + EPSILON) continue;
      if (span.start >= end - EPSILON) break;

      const overlap = Math.min(end, span.end) - Math.max(start, span.start);
      if (overlap <= EPSILON) continue;

      segments.push({
        category: span.category,
        tokens: overlap,
        from: clamp01((Math.max(start, span.start) - start) / size),
        to: clamp01((Math.min(end, span.end) - start) / size),
      });
    }

    const first = segments[0];
    const last = segments[segments.length - 1];
    if (first) first.from = 0;
    if (last) last.to = 1;

    let primary = segments[0];
    if (!primary) {
      cells.push({ index, segments: [], primary: "free", free: true });
      continue;
    }
    for (const segment of segments) {
      if (segment.tokens > primary.tokens) primary = segment;
    }

    cells.push({ index, segments, primary: primary.category, free: false });
    for (const segment of segments) {
      cellsByCategory[segment.category].push(index);
    }
  }

  for (let index = usedCells; index < cellCount; index += 1) {
    cells.push({ index, segments: [], primary: "free", free: true });
  }

  return { cells, total, denominator: safeDenominator, cellsByCategory };
}

/** Fit 档的分母：留 15% 余量，向上取两位有效数字，最低 10k。 */
export function fitDenominator(used: number): number {
  const scaled = positiveTokens(used) * FIT_HEADROOM;
  if (!Number.isFinite(scaled)) return Number.MAX_SAFE_INTEGER;
  if (scaled <= 0) return MIN_FIT_DENOMINATOR;
  const magnitude = 10 ** (Math.floor(Math.log10(scaled)) - 1);
  const rounded = Math.ceil(scaled / magnitude) * magnitude;
  return Math.max(MIN_FIT_DENOMINATOR, rounded);
}

/** 把格子内的分段换算成 CSS 渐变停靠点，百分比连续覆盖 0..100。 */
export function gradientStops(cell: MapCell): GradientStop[] {
  return cell.segments.map((segment) => ({
    category: segment.category,
    start: segment.from * 100,
    end: segment.to * 100,
  }));
}

/** 地图下方的 window bar：只表达 Used 与 Window 的关系。 */
export function windowBar(used: number, window: number): WindowBarState {
  const safeUsed = positiveTokens(used);
  const safeWindow = positiveTokens(window);
  const fraction = safeWindow > 0 ? Math.min(1, safeUsed / safeWindow) : 0;
  return {
    used: safeUsed,
    window: safeWindow,
    fraction,
    free: Math.max(0, safeWindow - safeUsed),
    over: safeUsed > safeWindow,
  };
}

/** Breakdown 只列出非空分类，Free space 单独一行。 */
export function buildBreakdown(
  categories: readonly CategoryUsage[],
  used: number,
  window: number,
): Breakdown {
  const usage = new Map<Category, CategoryUsage>();
  for (const entry of categories) {
    usage.set(entry.category, entry);
  }

  const rows: CategoryBreakdownRow[] = [];
  for (const category of CATEGORIES) {
    const entry = usage.get(category);
    const tokens = positiveTokens(entry?.tokens);
    const items = typeof entry?.items === "number" && Number.isFinite(entry.items)
      ? Math.max(0, Math.floor(entry.items))
      : 0;
    // 没有 token 也没有条目的分类不占一行；media 这类 0 token 但有条目的分类要留下。
    if (tokens <= 0 && items === 0) continue;
    rows.push({ kind: "category", category, items, tokens });
  }

  return {
    rows,
    free: { kind: "free", tokens: windowBar(used, window).free },
  };
}

/** 条目 id 形如 `category:index`，只解析分类前缀。 */
export function categoryOfItem(id: string): Category | null {
  const separator = id.indexOf(":");
  if (separator <= 0) return null;
  const name = id.slice(0, separator);
  return (CATEGORIES as readonly string[]).includes(name) ? (name as Category) : null;
}

export function itemsForCategory(
  items: readonly ItemSummary[],
  category: Category,
): ItemSummary[] {
  return items.filter((item) => categoryOfItem(item.id) === category);
}
