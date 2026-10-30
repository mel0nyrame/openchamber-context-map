// Throwaway server for the Context Map UI prototype.
// Run: bun prototype/server.ts
const file = new URL("./context-map.html", import.meta.url);

const server = Bun.serve({
  port: Number(process.env.PORT ?? 4173),
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/context-map") {
      return new Response(Bun.file(file), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Context Map prototype: http://localhost:${server.port}/?variant=A`);
