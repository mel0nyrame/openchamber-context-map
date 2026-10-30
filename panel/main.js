(()=>{var _="openchamber.sdk",S=1;var Ct=`
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [data-oc-scrolling] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [data-oc-scrolling] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [data-oc-scrolling]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [data-oc-scrolling] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;function wt(e){let o=e.documentElement;if(o.hasAttribute("data-oc-scrollbar-activity"))return;o.setAttribute("data-oc-scrollbar-activity","");let r=new WeakMap;e.addEventListener("scroll",(s)=>{let i=s.target===e?o:s.target;if(!(i instanceof Element))return;if(!i.hasAttribute("data-oc-scrolling"))i.setAttribute("data-oc-scrolling","");let a=r.get(i);if(a!==void 0)clearTimeout(a);r.set(i,setTimeout(()=>{r.delete(i),i.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var ir=`(${wt.toString()})(document);`;var Ut=128,It=65536;var Je=128;var Ye=65536;var on=/^[a-z][a-z0-9-]{0,39}$/;var qo=(e)=>Object(e)===e&&!Array.isArray(e),Mt=(e,o)=>Object.keys(e).every((r)=>o.includes(r)),en=(e)=>String(e)===e&&e.length>=1&&e.length<=60,tn=(e)=>String(e)===e&&e.length>=1&&e.length<=80,nn=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let o=new Set;for(let r of e){if(!qo(r)||!on.test(r.id)||!en(r.label))return!1;if(r.disabled!==void 0&&r.disabled!==!0&&r.disabled!==!1)return!1;if(o.has(r.id))return!1;if(o.add(r.id),r.kind==="button"){if(!Mt(r,["kind","id","label","disabled"]))return!1;continue}if(r.kind!=="select"||!Mt(r,["kind","id","label","value","options","disabled"]))return!1;if(!tn(r.value)||!Array.isArray(r.options)||r.options.length<1||r.options.length>16)return!1;let s=new Set;for(let i of r.options){if(!qo(i)||!Mt(i,["value","label"])||!tn(i.value)||!en(i.label)||s.has(i.value))return!1;s.add(i.value)}if(!s.has(r.value))return!1}return!0};var Qe=20000000,Ze=256;var Nt=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,rn=(e,o)=>{if(e.path!==o.path||e.readOnly!==o.readOnly)return!1;if(e.encoding==="text"||o.encoding==="text")return e.encoding==="text"&&o.encoding==="text"&&e.content===o.content;if(e.bytes.byteLength!==o.bytes.byteLength)return!1;for(let r=0;r<e.bytes.byteLength;r+=1)if(e.bytes[r]!==o.bytes[r])return!1;return!0};var sn=/^[A-Za-z0-9_-]{1,80}$/;var an=["left","right","top","bottom"];var cn=(e,o=0,r={remaining:16000})=>{if(--r.remaining<0||o>=32)return!1;if(e===null)return!0;let s=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let i of s)if(!cn(i,o+1,r))return!1;return!0},Lt=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((o)=>/^(0|[1-9]\d*)$/.test(o)&&Number(o)<e.length)&&e.every(Lt);if(Object(e)===e){let o=Object.getPrototypeOf(e);return(o===null||o===Object.prototype)&&Object.values(e).every(Lt)}return String(e)===e||Number.isFinite(e)},Gt=(e)=>{try{if(String(e.id)!==e.id||!sn.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!an.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!cn(e.data)||!Lt(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var ln=["file","directory","other","missing"],Dt=(e)=>Boolean(e&&"sessionId"in e),$t=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var pn=/^[0-9a-f]{7,64}$/i,Ht=(e)=>pn.test(e),qe=500,et=32000,un=16000,fn=128,En=200,mn=2000,_n=16000,Sn=80,Tn=200,hn=16000;var gn=2000;var Xt=20000,tt=1024,ot=2000000;var nt=64000,rt=8000,Ft=4000;var Bt=960000;var xn=999,bn=1e4,De=500,An=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],On=["stopped","starting","ready","failed"],cr=new Set(An),yn=(e)=>cr.has(e),kn=(e)=>e&&yn(e)?e:"HOST_REJECTED",ge=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(ge);if(Object(e)===e)return Object.values(e).every(ge);return!1},Rn=(e)=>ge(e)&&JSON.stringify(e).length<=hn,dn=(e)=>e?.trim().slice(0,Tn)??"",xe=(e)=>{let o=e.id.trim().slice(0,fn),r=e.title.trim().slice(0,En),s=e.url.trim().slice(0,mn),i=e.text?.trim().slice(0,_n),a=e.author?.trim().slice(0,Sn),T=e.kind==="pull"?"pull":"issue",u={providerId:e.providerId.trim(),id:o,title:r||o,url:s,kind:T};if(i)u.text=i;if(a)u.author=a;if(T==="pull"){let m=dn(e.branches?.head),h=dn(e.branches?.base);if(m&&h)u.branches={head:m,base:h}}if(Rn(e.data))u.data=e.data;return u},Vt=(e)=>{let o=xe(e);if(e.projectId)o.projectId=e.projectId;if(e.navigation)o.navigation=e.navigation;if(e.worktree)o.worktree=e.worktree;return o},zt=(e)=>{let o={text:e.text.trim().slice(0,un)};if(e.send)o.send=!0;return o},jt=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(xn,Math.max(0,Math.round(e)))},Wt=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(bn,Math.max(0,Math.ceil(e)))};var be=(e)=>e.length>0&&e.length<=tt&&!e.includes("\x00")&&!e.includes("\\");var st=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>gn)return!1;return!e.split("/").some((r)=>r==="."||r==="..")},dr=new Set(On),Kt=(e)=>Boolean(e&&"status"in e&&dr.has(String(e.status))&&!("body"in e)),it=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),Jt=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),Yt=(e)=>Boolean(e&&"written"in e&&e.written===!0),Qt=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),lr=new Set(ln),Zt=(e)=>Boolean(e&&"kind"in e&&"size"in e&&lr.has(String(e.kind))&&Number.isFinite(e.size)),qt=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),pr=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late"]),ur=(e)=>Object(e)===e?e:null,Pt=(e)=>String(e)===e&&e.length>0,fr=(e)=>{if(!Pt(e.id))return null;if(e.ok===!0){let o={channel:_,v:S,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)o.payload=e.payload;return o}if(e.ok===!1&&Pt(e.error))return{channel:_,v:S,type:"result",id:e.id,ok:!1,error:e.error,code:kn(Pt(e.code)?e.code:void 0)};return null},eo=(e)=>{let o=ur(e);if(!o||o.channel!==_||o.v!==S)return null;if(o.type==="result")return fr(o);if(!pr.has(String(o.type))||Object(o.payload)!==o.payload)return null;return o};var vn=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Er=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class l extends Error{code;constructor(e,o){super(o);this.name="HostRequestError",this.code=e}}var Cn=()=>Promise.reject(new l("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),at=()=>Promise.reject(new l("BAD_PATH",`File path must be 1 to ${tt} characters without NUL or backslash.`)),ct=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new l("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},E=(e)=>(e.value+=1,`oc-${e.value}`),to=(e={})=>{let o=e.target??("window"in globalThis?window:null);if(!o)throw new l("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let r=e.acceptSource??((t)=>t===o.parent),s=e.requestTimeoutMs??Xt,i=new Set,a=new Set,T=new Set,u=new Set,m=new Set,h=new Set,A=new Set,O=new Set,J=new Set,V=new Set,z=[],g=null,j=null,Z=new Set,ae=new Set,Ne=null,Le=null,yt=!1,Se=new Map,Te=new Map,he=new Map,Q=!1,f={value:0},p=null,q=null,Ge=!1,Pe=!1,Xo=null,Fo=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},X=(t)=>{o.parent.postMessage(t,"*")},Bo=()=>{if(Q||o.parent===o||V.size===0||p?.features?.lateGenerateResults!==!0)return;X({channel:_,v:S,type:"generate-late-listen"})},v=(t,n)=>{for(let c of t)try{c(n)}catch(d){console.error(d)}},Vo=(t)=>{if(!(t instanceof MessageEvent))return;if(!r(t.source))return;let n=eo(t.data);if(!n)return;if(n.type==="workspace"){let d=Te.get(n.payload.subscriptionId);if(d)v([d],n.payload.snapshot);return}if(n.type==="shells"){let d=he.get(n.payload.subscriptionId);if(d)v([d],n.payload.snapshot);return}if(n.type==="ready"){if(p=n.payload,q=Fo(n.payload.session),v(i,n.payload),v(a,n.payload.directory),v(T,n.payload.session),q)v(u,q);v(m,n.payload.connection),v(h,n.payload.settings),v(A,n.payload.item),Bo();return}if(n.type==="generate-late"){if(V.size===0)z.push(n.payload);else v(V,n.payload);return}if(n.type==="directory"){if(p)p={...p,directory:n.payload.directory};v(a,n.payload.directory);return}if(n.type==="session"){if(p)p={...p,session:n.payload.session};if(!n.payload.session)q=null;else if(q?.sessionId!==n.payload.session.id)q=Fo(n.payload.session);v(T,n.payload.session);return}if(n.type==="session-lifecycle"){q=n.payload,v(u,n.payload);return}if(n.type==="connection"){if(p)p={...p,connection:n.payload.connection};v(m,n.payload.connection);return}if(n.type==="settings"){if(p)p={...p,settings:n.payload.settings};v(h,n.payload.settings);return}if(n.type==="item"){if(p)p={...p,item:n.payload.item};v(A,n.payload.item);return}if(n.type==="status-control-event"){v(O,n.payload);return}if(n.type==="popover-closed"){v(J,n.payload);return}if(n.type==="action"){let d=(x)=>{if(!Q)X({channel:_,v:S,type:"action-result",id:n.id,payload:x})},b=j;if(!b){d({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>b(n.payload)).then(()=>d({ok:!0}),(x)=>{let I=(x instanceof Error?x.message:String(x)).trim();d({ok:!1,error:(I||"Action failed.").slice(0,De)})});return}if(n.type==="file-open"){let d=n.payload;if(Le&&rn(Le,d))return;Le=d,v(Z,n.payload);return}if(n.type==="file-saved"){v(ae,n.payload.version);return}if(n.type==="file-snapshot"){let d=(I)=>{if(!Q)X({channel:_,v:S,type:"file-snapshot-result",id:n.id,payload:I})},b=(I)=>d({error:(I.trim()||"Could not read the edited file.").slice(0,De)}),x=Ne;if(!x){b("This extension does not edit files.");return}Promise.resolve().then(()=>x(n.payload.purpose)).then((I)=>{if(Nt(I)>Qe){b(`The file is over ${Qe} ${"bytes"in I?"bytes":"characters"}.`);return}if(I.version.length>Ze){b(`The snapshot version is over ${Ze} characters.`);return}d({snapshot:"bytes"in I?{bytes:I.bytes,version:I.version}:{content:I.content,version:I.version}})},(I)=>b(I instanceof Error?I.message:String(I)));return}if(n.type==="resolve"){let d=(x)=>{X({channel:_,v:S,type:"resolve-result",id:n.id,payload:x})},b=g;if(!b){d({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>b(n.payload)).then((x)=>d({item:x?xe(x):null}),(x)=>{let I=(x instanceof Error?x.message:String(x)).trim();d({error:(I||"Command failed.").slice(0,De)})});return}let c=Se.get(n.id);if(!c)return;if(clearTimeout(c.timer),Se.delete(n.id),n.ok){c.resolve(n.payload);return}c.reject(new l(n.code,n.error))};o.addEventListener("message",Vo),X({channel:_,v:S,type:"hello"});let P=(t,n=s)=>{if(Q||o.parent===o)return Promise.reject(new l("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((c,d)=>{let b=setTimeout(()=>{Se.delete(t.id),d(new l("HOST_TIMEOUT","Host did not answer in time."))},n);Se.set(t.id,{resolve:c,reject:d,timer:b}),X(t)})},w=(t)=>P(t).then(()=>{return}),U={channel:_,v:S},kt=(t)=>{if(!Q&&o.parent!==o)X(t)},zo=()=>kt({...U,type:"file-save"}),jo=(t)=>{if(!vn(t)||!Er(t))return;t.preventDefault(),zo()},Wo=(t)=>{if(!vn(t)||t.key!=="Escape"||p?.surface!=="popover"||!p.popover)return;t.preventDefault(),Qo(p.popover.id,"escape").catch(()=>{return})},je=()=>{let t=p?.surface==="popover"?p.popover:void 0;if(!t)return;let n=Ge||Pe;if(Xo===n)return;Xo=n,Zo(t.id,n).catch(()=>{return})},We=()=>{if(p?.surface!=="popover"||Ge)return;Ge=!0,je()},Ko=(t)=>{if(p?.surface!=="popover"||t.relatedTarget!==null||!Ge)return;Ge=!1,je()},Jo=()=>{if(p?.surface!=="popover"||Pe)return;Pe=!0,je()},Yo=()=>{if(p?.surface!=="popover"||!Pe)return;Pe=!1,je()},Y=(t,n=1024)=>{if(!t.trim()||t.length>n)throw new l("HOST_REJECTED",`Identity must contain 1 to ${n} characters.`)},Rt=async(t)=>{if(t.kind!=="projects")Y(t.projectId);let n=await P({...U,type:"workspace-read",id:E(f),payload:t});if(!n||!("kind"in n)||!("state"in n)||n.kind!==t.kind)throw new l("HOST_REJECTED","Host did not return workspace data.");return n},vt=async(t,n)=>{if(t.kind!=="projects")Y(t.projectId);let c=E(f);Te.set(c,n);try{await w({...U,type:"workspace-subscribe",id:E(f),payload:{subscriptionId:c,query:t}})}catch(d){if(Te.delete(c),!Q)X({...U,type:"workspace-unsubscribe",id:E(f),payload:{subscriptionId:c}});throw d}return()=>{if(!Te.delete(c)||Q)return;X({...U,type:"workspace-unsubscribe",id:E(f),payload:{subscriptionId:c}})}},sr=async(t,n)=>{if(t.kind==="session")Y(t.sessionId);if(t.kind==="project")Y(t.projectId);let c=E(f);he.set(c,n);try{await w({...U,type:"shells-subscribe",id:E(f),payload:{subscriptionId:c,scope:t}})}catch(d){if(he.delete(c),!Q)X({...U,type:"shells-unsubscribe",id:E(f),payload:{subscriptionId:c}});throw d}return()=>{if(!he.delete(c)||Q)return;X({...U,type:"shells-unsubscribe",id:E(f),payload:{subscriptionId:c}})}},Ke=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>Ut))throw new l("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!ge(t.value))throw new l("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>It)throw new l("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&p?.features?.deviceStorage!==!0)throw new l("UNSUPPORTED","This host does not support device storage.");let n=await P({...U,type:"storage",id:E(f),payload:t});if(!n||!("storage"in n)||n.op!==t.op)throw new l("HOST_REJECTED","Host did not return storage data.");return n},Qo=(t,n)=>p?.features?.popovers!==!0&&!(p?.surface==="popover"&&p.popover?.id===t)?Promise.reject(new l("UNSUPPORTED","This host does not support popovers.")):w({...U,type:"popover-close",id:E(f),payload:n?{id:t,reason:n}:{id:t}}),Zo=(t,n)=>p?.features?.popovers!==!0&&!(p?.surface==="popover"&&p.popover?.id===t)?Promise.reject(new l("UNSUPPORTED","This host does not support popovers.")):w({...U,type:"popover-anchor",id:E(f),payload:{id:t,active:n}});return o.addEventListener("keydown",Wo,!0),o.addEventListener("pointerover",We),o.addEventListener("pointermove",We),o.addEventListener("pointerout",Ko),o.addEventListener("focus",Jo),o.addEventListener("blur",Yo),{onAction:(t)=>(j=t,()=>{if(j===t)j=null}),listProjects:async()=>{let t=await Rt({kind:"projects"});if(t.kind!=="projects")throw new l("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let n=await Rt({kind:"worktrees",projectId:t});if(n.kind!=="worktrees")throw new l("HOST_REJECTED","Expected worktrees.");return n},listSessions:async(t)=>{let n=await Rt({kind:"sessions",projectId:t});if(n.kind!=="sessions")throw new l("HOST_REJECTED","Expected sessions.");return n},onProjects:(t)=>vt({kind:"projects"},(n)=>{if(n.kind==="projects")t(n)}),onWorktrees:(t,n)=>vt({kind:"worktrees",projectId:t},(c)=>{if(c.kind==="worktrees")n(c)}),onSessions:(t,n)=>vt({kind:"sessions",projectId:t},(c)=>{if(c.kind==="sessions")n(c)}),onRunningShells:(t,n)=>sr(t,n),readShellOutput:async(t,n)=>{Y(t,Je);let c=n?.cursor;if(c!==void 0&&(!Number.isInteger(c)||c<0))throw new l("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let d=n?.tailBytes;if(d!==void 0&&(!Number.isInteger(d)||d<1||d>Ye))throw new l("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${Ye}.`);let x=await P({...U,type:"shell-output",id:E(f),payload:{shellId:t,cursor:c,tailBytes:d}});if(!x||typeof x.output!=="string"||!Number.isFinite(x.cursor))throw new l("HOST_REJECTED","Host did not return shell output.");return x},stopShell:async(t)=>{if(Y(t,Je),(await P({...U,type:"shell-stop",id:E(f),payload:{shellId:t}}))?.stopped!==!0)throw new l("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{Y(t),await w({...U,type:"open-session",id:E(f),payload:{sessionId:t}})},storage:{get:async(t,n)=>{let c=ct(n),d={op:"get",key:t};if(c)d.scope=c;let b=await Ke(d);return b.op==="get"&&b.found?b.value:void 0},set:async(t,n,c)=>{let d=ct(c),b={op:"set",key:t,value:n};if(d)b.scope=d;await Ke(b)},delete:async(t,n)=>{let c=ct(n),d={op:"delete",key:t};if(c)d.scope=c;await Ke(d)},keys:async(t)=>{let n=ct(t),c={op:"keys"};if(n)c.scope=n;let d=await Ke(c);if(d.op!=="keys")throw new l("HOST_REJECTED","Expected storage keys.");return d.keys}},onReady:(t)=>{if(i.add(t),p)t(p);return()=>{i.delete(t)}},onDirectory:(t)=>{if(a.add(t),p)t(p.directory);return()=>{a.delete(t)}},onSession:(t)=>{if(T.add(t),p)t(p.session);return()=>{T.delete(t)}},onSessionLifecycle:(t)=>{if(u.add(t),q)t(q);return()=>{u.delete(t)}},onConnection:(t)=>{if(m.add(t),p)t(p.connection);return()=>{m.delete(t)}},onSettings:(t)=>{if(h.add(t),p)t(p.settings);return()=>{h.delete(t)}},onItem:(t)=>{if(A.add(t),p)t(p.item);return()=>{A.delete(t)}},onStatusControl:(t)=>(O.add(t),()=>{O.delete(t)}),onPopoverClosed:(t)=>(J.add(t),()=>{J.delete(t)}),setStatusControls:(t)=>{if(p?.features?.statusControls!==!0)return Promise.reject(new l("UNSUPPORTED","This host does not support status controls."));if(!nn(t))return Promise.reject(new l("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return w({...U,type:"status-controls",id:E(f),payload:{controls:t}})},openPopover:(t)=>{if(p?.features?.popovers!==!0)return Promise.reject(new l("UNSUPPORTED","This host does not support popovers."));if(!Gt(t))return Promise.reject(new l("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return w({...U,type:"popover-open",id:E(f),payload:t})},closePopover:Qo,setPopoverAnchorActive:Zo,onResolve:(t)=>(g=t,()=>{if(g===t)g=null}),toast:(t)=>{let n=t.message.trim();if(!n||n.length>qe)return Promise.reject(new l("HOST_REJECTED",`Toast message must contain 1 to ${qe} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>et))return Promise.reject(new l("HOST_REJECTED",`Toast copy text must contain 1 to ${et} characters.`));return w({channel:_,v:S,type:"toast",id:E(f),payload:{...t,message:n}})},openUrl:(t)=>w({channel:_,v:S,type:"open-url",id:E(f),payload:{url:t}}),openCommit:(t)=>Ht(t)?w({channel:_,v:S,type:"open-commit",id:E(f),payload:{sha:t}}):Promise.reject(new l("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),openSurface:(t)=>w({channel:_,v:S,type:"open-surface",id:E(f),payload:{surfaceId:t}}),writeClipboard:(t)=>w({channel:_,v:S,type:"clipboard-write",id:E(f),payload:{text:t}}),compose:(t)=>w({channel:_,v:S,type:"compose",id:E(f),payload:t}),attach:(t)=>w({channel:_,v:S,type:"attach",id:E(f),payload:xe(t)}),startSession:async(t)=>{if(t.projectId!==void 0)Y(t.projectId);let n=t.worktree;if(n&&n!==!0)if(n.kind==="existing")Y(n.directory);else{if(n.name!==void 0)Y(n.name,200);if(n.baseBranch!==void 0)Y(n.baseBranch,200)}let c=await P({channel:_,v:S,type:"start-session",id:E(f),payload:Vt(t)},e.requestTimeoutMs??180000);if(!Dt(c))throw new l("HOST_REJECTED","Host did not return a session.");return c},prompt:(t)=>P({channel:_,v:S,type:"prompt",id:E(f),payload:zt(t)}).then((n)=>{if(!$t(n))throw new l("HOST_REJECTED","Host did not return a prompt result.");return n}),sessionLink:(t)=>w({channel:_,v:S,type:"session-link",id:E(f),payload:xe(t)}),close:()=>w({channel:_,v:S,type:"close",id:E(f)}),oauthStart:()=>w({channel:_,v:S,type:"oauth-start",id:E(f)}),oauthDisconnect:()=>w({channel:_,v:S,type:"oauth-disconnect",id:E(f)}),request:(t)=>(st(t.path)?P({channel:_,v:S,type:"request",id:E(f),payload:t}):Cn()).then((n)=>{if(!it(n))throw new l("HOST_REJECTED","Host request result was empty.");return n}),serviceRequest:(t)=>(st(t.path)?P({channel:_,v:S,type:"service-request",id:E(f),payload:t}):Cn()).then((n)=>{if(!it(n))throw new l("HOST_REJECTED","Host service request result was empty.");return n}),serviceStatus:()=>P({channel:_,v:S,type:"service-status",id:E(f)}).then((t)=>{if(!Kt(t))throw new l("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(be(t)?P({channel:_,v:S,type:"file-read",id:E(f),payload:{path:t}}):at()).then((n)=>{if(!Jt(n))throw new l("HOST_REJECTED","Host did not return file content.");return n}),writeFile:(t,n)=>{if(!be(t))return at();if(n.length>ot)return Promise.reject(new l("FILE_TOO_LARGE",`Content is over ${ot} characters.`));return P({channel:_,v:S,type:"file-write",id:E(f),payload:{path:t,content:n}}).then((c)=>{if(!Yt(c))throw new l("HOST_REJECTED","Host did not confirm the write.");return c})},listDir:(t)=>(be(t)?P({channel:_,v:S,type:"file-list",id:E(f),payload:{path:t}}):at()).then((n)=>{if(!Qt(n))throw new l("HOST_REJECTED","Host did not return directory entries.");return n}),stat:(t)=>(be(t)?P({channel:_,v:S,type:"file-stat",id:E(f),payload:{path:t}}):at()).then((n)=>{if(!Zt(n))throw new l("HOST_REJECTED","Host did not return file status.");return n}),generate:(t)=>{let n=t.prompt.trim(),c=t.system?.trim();if(n.length===0||n.length>nt)return Promise.reject(new l("HOST_REJECTED",`Prompt must be 1 to ${nt} characters.`));if(c!==void 0&&(c.length===0||c.length>rt))return Promise.reject(new l("HOST_REJECTED",`System prompt must be 1 to ${rt} characters.`));let d=t.maxOutputTokens===void 0?void 0:Math.min(Ft,Math.max(1,Math.floor(t.maxOutputTokens)));if(d!==void 0&&!Number.isFinite(d))return Promise.reject(new l("HOST_REJECTED","maxOutputTokens must be a number."));let b={prompt:n};if(c!==void 0)b.system=c;if(d!==void 0)b.maxOutputTokens=d;return P({channel:_,v:S,type:"generate",id:E(f),payload:b},e.requestTimeoutMs??Bt).then((x)=>{if(!qt(x))throw new l("HOST_REJECTED","Host did not return generated text.");return x})},onLateGenerateResult:(t)=>{V.add(t);for(let n of z.splice(0))v([t],n);return Bo(),()=>{V.delete(t)}},setBadge:(t)=>w({channel:_,v:S,type:"badge",id:E(f),payload:{count:jt(t)}}),setHeight:(t)=>w({channel:_,v:S,type:"resize",id:E(f),payload:{height:Wt(t)}}),onFileOpen:(t)=>{if(Z.add(t),!yt)yt=!0,o.addEventListener("keydown",jo,!0);if(Le)t(Le);return()=>{Z.delete(t)}},onFileSnapshot:(t)=>(Ne=t,()=>{if(Ne===t)Ne=null}),onFileSaved:(t)=>(ae.add(t),()=>{ae.delete(t)}),reportFileChange:(t)=>kt({...U,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:zo,reportFileUnsupported:()=>kt({...U,type:"file-unsupported"}),dispose:()=>{for(let t of Te.keys())X({...U,type:"workspace-unsubscribe",id:E(f),payload:{subscriptionId:t}});Te.clear();for(let t of he.keys())X({...U,type:"shells-unsubscribe",id:E(f),payload:{subscriptionId:t}});if(he.clear(),Q=!0,g=null,j=null,Ne=null,Z.clear(),ae.clear(),yt)o.removeEventListener("keydown",jo,!0);o.removeEventListener("message",Vo),o.removeEventListener("keydown",Wo,!0),o.removeEventListener("pointerover",We),o.removeEventListener("pointermove",We),o.removeEventListener("pointerout",Ko),o.removeEventListener("focus",Jo),o.removeEventListener("blur",Yo);for(let t of Se.values())clearTimeout(t.timer),t.reject(new l("HOST_UNAVAILABLE","Host client was disposed."));Se.clear(),i.clear(),a.clear(),T.clear(),u.clear(),m.clear(),h.clear(),A.clear(),O.clear(),J.clear(),V.clear(),z.length=0}}};var wn=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var Ts=new Set(wn);var Un=["none","agent","user"];var gs=new Set(Un);var mr=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],_r=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],In=(e,o)=>{o.style.colorScheme=e.mode;for(let[r,s]of mr)o.style.setProperty(r,e.tokens[s]);for(let[r,s,i]of _r){let a=e.tokens[i]??"";o.style.setProperty(r,a),o.style.setProperty(s,a)}o.style.setProperty("font-family",e.tokens.font),o.style.setProperty("font-size","0.875rem"),o.style.setProperty("line-height","1.45"),o.style.setProperty("color",e.tokens.foreground)},oo=(e,o)=>{if(In(e.theme,o),o.dataset)o.dataset.ocSurface=e.surface,o.dataset.ocTheme=e.theme.mode};var Sr={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},k=(e,o)=>`var(--${e}, var(--oc-${Sr[e]}, ${o}))`,te=k("surface-background","transparent"),lt=k("surface-elevated","transparent"),Ae=k("surface-elevated-foreground","inherit"),W=k("surface-foreground","inherit"),y=k("surface-muted-foreground","gray"),Tr=k("surface-muted","transparent"),ce=k("interactive-border","currentColor"),D=k("interactive-hover","transparent"),fe=k("interactive-active","transparent"),no=k("interactive-selection","transparent"),ro=k("interactive-selection-foreground","inherit"),ee=k("primary","currentColor"),so=k("primary-text","inherit"),io=k("error-text","inherit"),hr=k("font-sans","inherit"),ao=k("font-mono","monospace"),Pn=k("radius","9px"),co=`calc(${Pn} - 2px)`,Mn=`calc(${Pn} - 4px)`,C=(e,o,r="transparent")=>`color-mix(in srgb, ${e} ${o}%, ${r})`,Nn=`background-image: linear-gradient(${D}, ${D});`,lo=(e)=>`box-shadow: inset 0 0 0 1px ${e}, var(--oc-sdk-field-lift);`,po="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",Ln="box-shadow: var(--oc-sdk-lit);",Gn=`inset 0 1px 0 0 ${C(W,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2)`,gr=`
:root {
  --oc-sdk-edge: ${C(W,10)};
  --oc-sdk-field-bg: ${lt};
  --oc-sdk-raised-bg: ${te};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 2px 0 rgb(0 0 0 / 0.06);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.45), 0 1px 2px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.1);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.8), inset 0 0 0 1px rgb(0 0 0 / 0.04), 0 1px 2px -0.5px rgb(0 0 0 / 0.08), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.08);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${C(W,6)};
  --oc-sdk-field-bg: ${C(te,50,lt)};
  --oc-sdk-raised-bg: ${lt};
  --oc-sdk-field-lift: ${Gn};
  --oc-sdk-raised-lift: ${Gn};
  --oc-sdk-lit: inset 0 1px 0 0 ${C(W,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.36);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.06), inset 0 0 0 1px rgb(255 255 255 / 0.08), 0 1px 1px -0.5px rgb(0 0 0 / 0.22), 0 3px 3px -1.5px rgb(0 0 0 / 0.2), 0 6px 6px -3px rgb(0 0 0 / 0.16);
}`,dt=(e)=>{let o=k(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${o}; --oc-sdk-tone-text: ${k(`${e}-text`,"inherit")}; }`},xr=`
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 12px; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: 6px; height: 28px; padding: 0 10px; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: 4px; height: 24px; padding: 0 8px; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: 14px; height: 14px; }

.oc-sdk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: 32px; padding: 0 10px; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: 8px 10px; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: 34px; padding-right: 34px; }
.oc-sdk-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: 24px; height: 24px; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: 2px; min-width: 160px; max-width: calc(100vw - 16px); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 4px; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: 2px 2px 4px; }
.oc-sdk-popup-search .oc-sdk-input { height: 28px; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: 14px; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: 8px; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-top: 3px; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: 36px; height: 20px; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: 2px; padding: 2px; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: 1px 6px; font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: 16px 8px; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 40px 16px; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: 12px; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: 16px; height: 16px; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: 12px; height: 12px; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: 8px; width: 100%; margin: 8px 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: 4px 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: 6px; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: 8px 0; }
`,Dn=`${gr}
.oc-sdk { color: ${W}; font-family: ${hr}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${Nn} }
.oc-sdk-mono { font-family: ${ao}; }
.oc-sdk-muted { color: ${y}; }
${dt("success")}${dt("warning")}${dt("error")}${dt("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${ee}; --oc-sdk-tone-text: ${so}; }

.oc-sdk-btn { border-radius: ${co}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Mn}; }
.oc-sdk-btn[data-variant="default"] { color: ${so}; background: ${C(ee,10,te)}; border-color: ${C(ee,12)}; ${Ln} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${C(ee,16,te)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${C(ee,22,te)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${Tr}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${D}, ${D}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${fe}, ${fe}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${Ae}; ${po} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${D}, ${D}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${fe}, ${fe}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${D}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${fe}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${k("status-error","red")}; color: ${io}; background: ${C("var(--oc-sdk-tone)",7,te)}; border-color: ${C("var(--oc-sdk-tone)",12)}; ${Ln} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${C("var(--oc-sdk-tone)",9,te)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${C("var(--oc-sdk-tone)",11,te)}; box-shadow: none; }

.oc-sdk-field-note { color: ${y}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${io}; }
.oc-sdk-input { border-radius: ${co}; background: var(--oc-sdk-field-bg); color: ${Ae}; ${lo("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${y}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${D}, ${D}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${lo(C(W,26))} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${lo(k("status-error","red"))} }
.oc-sdk-input[data-mono="true"] { font-family: ${ao}; }

.oc-sdk-search-icon { color: ${y}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${ee}; }
.oc-sdk-search-clear { border-radius: ${Mn}; color: ${y}; }
.oc-sdk-search-clear:hover { background: ${D}; color: ${W}; }

.oc-sdk-trigger { border-radius: ${co}; background: var(--oc-sdk-raised-bg); color: ${Ae}; ${po} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${D}, ${D}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${fe}, ${fe}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${y}; }
.oc-sdk-trigger-chevron { color: ${y}; }
/* The app's dropdown light: lit top, hairline rings and a layered shadow. Its outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${Ae}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${lt}; background-clip: padding-box; color: ${Ae}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${D}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${no}; color: ${ro}; }
.oc-sdk-option-check { color: ${W}; }
.oc-sdk-option[data-destructive="true"] { color: ${io}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${C(k("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${y}; }
.oc-sdk-popup-empty { color: ${y}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${ce}; border-radius: 4px; color: ${W}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${C(W,60,ce)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${ce}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${te}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${ee}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${Nn} }
.oc-sdk-check-desc { color: ${y}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${C(W,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${y}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${W}; }
.oc-sdk-tab[aria-selected="true"] { color: ${ro}; background: ${no}; border-color: ${ce}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${Ae}; background: var(--oc-sdk-raised-bg); ${po} }
.oc-sdk-tab-count { color: ${y}; }

.oc-sdk-badge { border-radius: 9999px; background: ${D}; color: ${y}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${C("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${D}; }
.oc-sdk-row[aria-selected="true"] { background: ${no}; color: ${ro}; }
.oc-sdk-row-lead { font-family: ${ao}; color: ${y}; }
.oc-sdk-row-sub { color: ${y}; }
.oc-sdk-row-meta { color: ${y}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${y}; }

.oc-sdk-empty-body { color: ${y}; }

.oc-sdk-spinner { color: ${y}; }
.oc-sdk-spinner-ring { border-color: ${ce}; border-top-color: ${ee}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${C("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${y}; }

.oc-sdk-separator { color: ${y}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${C(ce,40)}; }

.oc-sdk-progress-label { color: ${y}; }
.oc-sdk-progress-track { border-radius: 9999px; background: ${ce}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${ee}); }

.oc-sdk-text a { color: ${so}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${C(ce,60)}; }
`,N=`
${Ct}
${xr}
${Dn}`;var $n="oc-sdk-ui-style";var L=(e)=>{let o=document.getElementById($n);if(o instanceof HTMLStyleElement){if(o.textContent!==e)o.textContent=e;return}wt(document);let r=document.createElement("style");r.id=$n,r.textContent=e,document.head.appendChild(r)},R=(e,o)=>{let r=document.createElement(e);if(o)r.className=o;return r};var F=(e,o)=>{let r=o??"";if(e.textContent!==r)e.textContent=r},Oe=(e,o,r)=>{if(r===void 0||r===null||r==="")e.removeAttribute(o);else if(e.getAttribute(o)!==r)e.setAttribute(o,r)};var Et=(e,o)=>{Oe(e,"data-tone",o&&o!=="neutral"?o:null)},mt=(e,o)=>{L(N);let r=o,s=R("span","oc-sdk oc-sdk-badge");e.append(s);let i=()=>{F(s,r.label),Et(s,r.tone)};return i(),{update:(a)=>{r={...r,...a},i()},dispose:()=>{s.remove()}}};var yr=(e)=>Number.isFinite(e)?Math.min(100,Math.max(0,Math.round(e))):0,Eo=(e,o)=>{L(N);let r=o,s=R("div","oc-sdk oc-sdk-progress"),i=R("div","oc-sdk-progress-label"),a=R("span"),T=R("span");i.append(a,T);let u=R("div","oc-sdk-progress-track");u.setAttribute("role","progressbar"),u.setAttribute("aria-valuemin","0"),u.setAttribute("aria-valuemax","100");let m=R("div","oc-sdk-progress-fill");u.append(m),s.append(i,u),e.append(s);let h=()=>{let A=yr(r.value);if(Et(m,r.tone),m.style.transform=`scaleX(${A/100})`,u.setAttribute("aria-valuenow",String(A)),r.label)u.setAttribute("aria-label",r.label);else u.removeAttribute("aria-label");F(a,r.label),F(T,`${A}%`),i.hidden=!r.label};return h(),{update:(A)=>{r={...r,...A},h()},dispose:()=>{s.remove()}}};var oe=["system","toolDefinitions","userMessages","assistantText","reasoning","toolCalls","toolResults","other"];var ke={system:"系统提示",toolDefinitions:"工具定义",userMessages:"用户消息",assistantText:"助手文本",reasoning:"推理",toolCalls:"工具调用",toolResults:"工具结果",other:"其他"};var kr=25,Rr=8;var vr=kr*Rr,mo=0.000000001;function Cr(){let e={};for(let o of oe)e[o]=[];return e}function Hn(e){return Math.min(1,Math.max(0,e))}function _t(e){if(typeof e!=="number"||!Number.isFinite(e))return 0;return Math.max(0,e)}function Xn(e,o=vr){let r=Cr(),s=new Map;for(let m of e)s.set(m.category,m);let i=[],a=0;for(let m of oe){let h=_t(s.get(m)?.tokens);if(h<=0)continue;i.push({category:m,tokens:h,start:a,end:a+h}),a+=h}if(a<=0||o<=0)return{cells:[],total:0,cellsByCategory:r};let T=a/o,u=[];for(let m=0;m<o;m+=1){let h=m*T,A=(m+1)*T,O=[];for(let g of i){if(g.end<=h+mo)continue;if(g.start>=A-mo)break;let j=Math.min(A,g.end)-Math.max(h,g.start);if(j<=mo)continue;O.push({category:g.category,tokens:j,from:Hn((Math.max(h,g.start)-h)/T),to:Hn((Math.min(A,g.end)-h)/T)})}if(O.length===0)continue;let J=O[0],V=O[O.length-1];if(J)J.from=0;if(V)V.to=1;let z=O[0];if(!z)continue;for(let g of O)if(g.tokens>z.tokens)z=g;u.push({index:m,segments:O,primary:z.category});for(let g of O)r[g.category].push(m)}return{cells:u,total:a,cellsByCategory:r}}function Fn(e){return e.segments.map((o)=>({category:o.category,start:o.from*100,end:o.to*100}))}function St(e,o){let r=_t(e),s=_t(o),i=s>0?Math.min(1,r/s):0;return{used:r,window:s,fraction:i,free:Math.max(0,s-r),over:r>s}}function Bn(e,o,r){let s=new Map;for(let a of e)s.set(a.category,a);let i=[];for(let a of oe){let T=s.get(a),u=_t(T?.tokens);if(u<=0)continue;let m=typeof T?.items==="number"&&Number.isFinite(T.items)?Math.max(0,Math.floor(T.items)):0;i.push({kind:"category",category:a,items:m,tokens:u})}return{rows:i,free:{kind:"free",tokens:St(o,r).free}}}function wr(e){let o=e.indexOf(":");if(o<=0)return null;let r=e.slice(0,o);return oe.includes(r)?r:null}function Vn(e,o){return e.filter((r)=>wr(r.id)===o)}var Ur={light:{system:"#4a6588",toolDefinitions:"#3d7a6e",userMessages:"#96683c",assistantText:"#4b7a4b",reasoning:"#705d8c",toolCalls:"#96536a",toolResults:"#3f7484",other:"#6b7280"},dark:{system:"#8fa8c8",toolDefinitions:"#7fb8a8",userMessages:"#c8a878",assistantText:"#8fbf8f",reasoning:"#a898c8",toolCalls:"#c88fa0",toolResults:"#88b8c8",other:"#9aa3ad"}},Ir={light:"#7a828c",dark:"#6b7785"};function zn(e){let o=Ur[e];return`${oe.map((s)=>`--cat-${s}: ${o[s]};`).join(" ")} --cat-free: ${Ir[e]};`}function jn(){return`
:root, :root[data-oc-theme="light"] { ${zn("light")} }
:root[data-oc-theme="dark"] { ${zn("dark")} }
`}var Mr=2000,Nr=`
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .usage, .card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 18px; }
  .card-title { flex: none; font-weight: 600; }
  .map-hint { min-width: 0; max-width: 58%; color: var(--oc-muted); font-size: 11px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .map-wrap { position: relative; }
  .map { display: grid; grid-template-columns: repeat(25, minmax(0, 1fr)); gap: 2px; }
  .cell { appearance: none; -webkit-appearance: none; display: block; width: 100%; min-width: 0;
    aspect-ratio: 1; padding: 0; border: 0; border-radius: 2px; background: var(--oc-border);
    cursor: pointer; transition: opacity .12s ease; }
  .cell:hover { outline: 1px solid var(--oc-fg); outline-offset: 1px; }
  .cell.is-active { outline: 2px solid var(--oc-fg); outline-offset: 1px; }
  .cell.is-dim { opacity: .32; }
  .map-tip { position: absolute; z-index: 3; left: 0; top: 0; max-width: 100%; padding: 6px 8px;
    border: 1px solid var(--oc-border); border-radius: 6px; background: var(--oc-elevated);
    color: var(--oc-fg); box-shadow: 0 6px 18px rgba(0, 0, 0, .22); font-size: 11px; line-height: 1.45;
    pointer-events: none; transform: translate(-50%, -100%); }
  .map-tip.is-below { transform: translate(-50%, 0); }
  .tip-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .tip-row + .tip-row { margin-top: 2px; }
  .tip-tokens { margin-left: auto; color: var(--oc-muted); font-variant-numeric: tabular-nums; }
  .map-empty { padding: 12px 4px; color: var(--oc-muted); font-size: 11px; }
  .window-track { height: 5px; border-radius: 3px; overflow: hidden;
    background: color-mix(in srgb, var(--oc-fg) 12%, transparent); }
  .window-used { height: 100%; width: 0; border-radius: 3px; background: var(--oc-primary);
    transition: width .2s ease; }
  .window-used[data-over="true"] { background: var(--oc-error); }
  .window-caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px;
    color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .window-caption .is-over { color: var(--oc-fg); font-weight: 600; }
  .breakdown-list { display: flex; flex-direction: column; gap: 1px; }
  .row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 8px;
    width: 100%; padding: 6px; border: 0; border-radius: 6px; background: transparent; color: inherit;
    font: inherit; text-align: left; }
  button.row { cursor: pointer; }
  button.row:hover { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  button.row:focus-visible { background: color-mix(in srgb, var(--oc-fg) 7%, transparent);
    outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .row-free { cursor: default; }
  .swatch { width: 8px; height: 8px; border-radius: 2px; }
  .row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums;
    white-space: nowrap; }
  .row-meta.is-over { color: var(--oc-fg); font-weight: 600; }
  .back { appearance: none; border: 0; padding: 2px 5px; border-radius: 4px; background: transparent;
    color: var(--oc-primary); font: inherit; cursor: pointer; }
  .back:hover { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  .back:focus-visible { background: color-mix(in srgb, var(--oc-fg) 7%, transparent);
    outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .drill-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    padding: 2px 6px 6px; }
  .drill-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-weight: 600; }
  .drill-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums;
    white-space: nowrap; }
  .item-row { display: flex; flex-direction: column; gap: 1px; padding: 6px;
    border-top: 1px solid color-mix(in srgb, var(--oc-fg) 8%, transparent); }
  .item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .drill-empty { padding: 8px 6px; color: var(--oc-muted); font-size: 11px; }
  @media (max-width: 520px) {
    .map { grid-template-columns: repeat(20, minmax(0, 1fr)); }
    .row-meta { font-size: 10px; }
  }
  .usage-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .usage-title { font-weight: 600; }
  .usage-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
  .usage-model { color: var(--oc-muted); font-family: var(--oc-mono); font-size: 11px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .usage-meter { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .usage-numbers { font-variant-numeric: tabular-nums; }
  .usage-window { color: var(--oc-muted); }
  .usage-pct { font-weight: 600; font-variant-numeric: tabular-nums; }
  .status { display: flex; align-items: flex-start; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .dot { flex: none; width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: var(--oc-muted); }
  .status[data-state="connected"] .dot { background: var(--oc-success); }
  .status[data-state="disconnected"] .dot { background: var(--oc-warning, #d97706); }
  .status[data-state="failed"] .dot { background: var(--oc-error); }
  .status-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .status-title { font-weight: 600; }
  .status-detail { color: var(--oc-muted); font-size: 11px; }
  .placeholder { display: flex; flex-direction: column; gap: 4px; padding: 18px 12px;
    border-radius: var(--oc-radius); background: color-mix(in srgb, var(--oc-fg) 3%, transparent); }
  .placeholder-title { font-weight: 600; }
  .placeholder-detail { color: var(--oc-muted); font-size: 11px; }
  [hidden] { display: none !important; }
`,At=to(),Kn=document.querySelector("#root");if(!Kn)throw Error("Missing #root");var Jn=document.createElement("style");Jn.textContent=Nr;var Yn=document.createElement("style");Yn.textContent=jn();document.head.append(Jn,Yn);var xo=document.createElement("div");xo.className="head";var bo=document.createElement("div");bo.className="title";bo.textContent="Context Map";var Ao=document.createElement("div");Ao.className="subtitle";Ao.textContent="最后一次请求的上下文构成";xo.append(bo,Ao);var Ie=document.createElement("section");Ie.className="usage";Ie.hidden=!0;var Oo=document.createElement("div");Oo.className="usage-head";var yo=document.createElement("div");yo.className="usage-title";yo.textContent="Context usage";var ko=document.createElement("div");ko.className="usage-badges";var He=document.createElement("span");He.hidden=!0;He.title="部分数字由字符估算，provider 未提供完整 token 用量。";mt(He,{label:"estimated",tone:"warning"});var Xe=document.createElement("span");Xe.hidden=!0;Xe.title="没有取得模型窗口，按 200,000 tokens 估算。";mt(Xe,{label:"assumed window",tone:"info"});ko.append(He,Xe);Oo.append(yo,ko);var ht=document.createElement("div");ht.className="usage-model";var Ro=document.createElement("div");Ro.className="usage-meter";var vo=document.createElement("div");vo.className="usage-numbers";var Qn=document.createElement("span"),Co=document.createElement("span");Co.className="usage-window";vo.append(Qn,document.createTextNode(" / "),Co,document.createTextNode(" tokens"));var wo=document.createElement("div");wo.className="usage-pct";Ro.append(vo,wo);var Zn=document.createElement("div"),Lr=Eo(Zn,{value:0,label:"已用"});Ie.append(Oo,ht,Ro,Zn);var ue=document.createElement("section");ue.className="card map-card";ue.hidden=!0;var Uo=document.createElement("div");Uo.className="card-head";var Io=document.createElement("div");Io.className="card-title";Io.textContent="Context map";var _e=document.createElement("div");_e.className="map-hint";_e.setAttribute("aria-live","polite");_e.textContent="悬停或点击格子查看分类";Uo.append(Io,_e);var Fe=document.createElement("div");Fe.className="map-wrap";var me=document.createElement("div");me.className="map";me.setAttribute("role","group");me.setAttribute("aria-label","Context map，按已用 token 绘制");var K=document.createElement("div");K.className="map-tip";K.setAttribute("role","tooltip");K.hidden=!0;var Be=document.createElement("div");Be.className="map-empty";Be.textContent="这次请求还没有可绘制的上下文。";Be.hidden=!0;Fe.append(me,K,Be);var se=document.createElement("div");se.className="window-track";se.setAttribute("role","progressbar");se.setAttribute("aria-label","Used / Window");se.setAttribute("aria-valuemin","0");se.setAttribute("aria-valuemax","100");var gt=document.createElement("div");gt.className="window-used";se.append(gt);var Mo=document.createElement("div");Mo.className="window-caption";var qn=document.createElement("span"),So=document.createElement("span");Mo.append(qn,So);ue.append(Uo,Fe,se,Mo);var Me=document.createElement("section");Me.className="card breakdown-card";Me.hidden=!0;var No=document.createElement("div");No.className="card-head";var Lo=document.createElement("div");Lo.className="card-title";Lo.textContent="Breakdown";var pe=document.createElement("button");pe.type="button";pe.className="back";pe.textContent="返回";pe.hidden=!0;pe.addEventListener("click",()=>$o(null));No.append(Lo,pe);var Ee=document.createElement("div");Ee.className="breakdown-body";Me.append(No,Ee);var Ve=document.createElement("div");Ve.className="placeholder";var Go=document.createElement("div");Go.className="placeholder-title";var Po=document.createElement("div");Po.className="placeholder-detail";Ve.append(Go,Po);var ze=document.createElement("div");ze.className="status";ze.dataset.state="checking";var er=document.createElement("span");er.className="dot";var Do=document.createElement("div");Do.className="status-text";var Ce=document.createElement("div");Ce.className="status-title";var we=document.createElement("div");we.className="status-detail";Do.append(Ce,we);ze.append(er,Do);Kn.append(xo,Ie,ue,Me,Ve,ze);var de=null,Re=!1,To=!1,M=null,ne=!1,re=null,xt=null,ie=null,bt=new Map,B=null,H=null;document.addEventListener("pointerdown",(e)=>{if(!H)return;if(e.target instanceof Node&&Fe.contains(e.target))return;H=null,le()});document.addEventListener("keydown",(e)=>{if(e.key!=="Escape")return;if(H=null,B=null,le(),re)$o(null)});window.addEventListener("scroll",()=>{if(!B&&!H)return;B=null,H=null,le()},!0);window.addEventListener("resize",()=>{if(!B&&!H)return;B=null,H=null,le()});$e({kind:"checking"});ve("正在连接 Collector…","首次打开面板时，本地 Service 可能需要一点时间启动。");function Gr(e){return e.startsWith("v")?e:`v${e}`}function $e(e){if(ze.dataset.state=e.kind,e.kind==="checking"){Ce.textContent="正在连接本地 Service…",we.textContent="首次打开面板时，Service 可能需要一点时间启动。";return}if(e.kind==="connected"){Ce.textContent=`Collector 已连接 · ${Gr(e.version)}`,we.textContent="快照会通过本地 Service 读取，bearer 不会进入面板。";return}if(e.kind==="disconnected"){Ce.textContent="Collector 未连接",we.textContent=e.reason==="not_found"?"未找到采集器。启动 OpenCode 后会自动连接。":"采集器没有响应。重启 OpenCode 后再试。";return}Ce.textContent=e.title,we.textContent=e.detail}function Pr(e){if(e instanceof l){if(e.code==="NO_SERVICE"||e.code==="NOT_GRANTED")return{title:"本地 Service 未连接",detail:"在设置 → 扩展中允许 Context Map 的本地服务。"};if(e.code==="DISABLED")return{title:"Context Map 已暂停",detail:"在设置 → 扩展中重新启用。"};if(e.code==="SERVICE_FAILED")return{title:"本地 Service 已停止",detail:"它会在下次刷新时自动重启。"}}return{title:"无法连接本地 Service",detail:"请确认 OpenChamber 正在运行。"}}function ve(e,o){Ie.hidden=!0,ue.hidden=!0,Me.hidden=!0,xt=null,B=null,H=null,Ot(),Ve.hidden=!1,Go.textContent=e,Po.textContent=o}function Tt(){if(!To){ve("正在连接 Collector…","首次打开面板时，本地 Service 可能需要一点时间启动。");return}if(!de){ve("未打开 session","打开一个 session 后，这里会显示它的上下文占用。");return}if(!Re){ve("快照暂不可用","Collector 连接后会自动显示上下文占用。");return}if(ne){ve("快照暂时不可用","Collector 没有及时响应，稍后会自动重试。");return}if(!M||M.sessionID!==de.id){ve("还没有上下文快照","发起一次请求后，这里会显示最后一次请求的构成。");return}Vr(M)}function G(e){return new Intl.NumberFormat("zh-CN").format(e)}function tr(e){let o=Math.round(e*10)/10;return Number.isInteger(o)?String(o):o.toFixed(1)}function Dr(e){return[e.sessionID,e.collectedAt,e.used,e.window,e.categories.map((o)=>`${o.category}:${o.items}:${o.tokens}`).join(","),e.items.length].join("|")}function Wn(e){return String(Math.round(e*1000)/1000)}function $r(e){if(e.segments.length<=1)return`var(--cat-${e.primary})`;return`linear-gradient(135deg, ${Fn(e).map((r)=>`var(--cat-${r.category}) ${Wn(r.start)}% ${Wn(r.end)}%`).join(", ")})`}function Hr(e){return e.segments.map((o)=>`${ke[o.category]} ${G(Math.round(o.tokens))} tokens`).join("；")}function Xr(e){let o=Xn(e.categories);ie=o;let r=St(e.used,e.window);gt.style.width=`${r.fraction*100}%`,gt.dataset.over=r.over?"true":"false",se.setAttribute("aria-valuenow",String(Math.round(r.fraction*100))),se.setAttribute("aria-valuetext",`${tr(r.fraction*100)}%`),qn.textContent=`已用 ${G(r.used)} / ${G(r.window)} tokens`,So.textContent=r.over?`Free space ${G(r.free)} tokens · 已超出窗口`:`Free space ${G(r.free)} tokens`,So.classList.toggle("is-over",r.over),B=null,H=null,Ot(),me.replaceChildren(),bt=new Map;let s=o.cells.length>0;me.hidden=!s,Be.hidden=s,_e.textContent=s?"悬停或点击格子查看分类":"没有可绘制的已用上下文";for(let i of o.cells){let a=document.createElement("button");a.type="button",a.className="cell",a.tabIndex=-1,a.style.background=$r(i),a.setAttribute("aria-label",Hr(i)),a.dataset.index=String(i.index),a.addEventListener("pointerenter",()=>{B={cell:i,element:a},le()}),a.addEventListener("pointerleave",()=>{if(B?.element===a)B=null;le()}),a.addEventListener("click",(T)=>{T.stopPropagation(),H=H?.element===a?null:{cell:i,element:a},le()}),bt.set(i.index,a),me.append(a)}}function le(){let e=B??H;if(!e||!e.element.isConnected||ue.hidden){Ot();return}Fr(e.cell,e.element)}function Fr(e,o){let r=document.createDocumentFragment();for(let s of e.segments){let i=document.createElement("div");i.className="tip-row";let a=document.createElement("span");a.className="swatch",a.style.background=`var(--cat-${s.category})`;let T=document.createElement("span");T.textContent=ke[s.category];let u=document.createElement("span");u.className="tip-tokens",u.textContent=`${G(Math.round(s.tokens))} tokens`,i.append(a,T,u),r.append(i)}K.replaceChildren(r),K.hidden=!1,_e.textContent=e.segments.map((s)=>`${ke[s.category]} ${G(Math.round(s.tokens))}`).join(" · "),Br(o)}function Br(e){let o=Fe.getBoundingClientRect(),r=e.getBoundingClientRect(),s=K.getBoundingClientRect(),i=s.width/2,a=r.left-o.left+r.width/2,T=Math.max(i+2,Math.min(o.width-i-2,a)),u=r.top-o.top>=s.height+8;K.classList.toggle("is-below",!u),K.style.left=`${T}px`,K.style.top=u?`${r.top-o.top-6}px`:`${r.bottom-o.top+6}px`}function Ot(){if(K.hidden=!0,K.replaceChildren(),!ue.hidden)_e.textContent=ie&&ie.cells.length>0?"悬停或点击格子查看分类":"没有可绘制的已用上下文"}function $o(e){re=e,B=null,H=null,le(),or(),nr()}function or(){let e=re,o=e&&ie?new Set(ie.cellsByCategory[e]):null;for(let[r,s]of bt){let i=o?.has(r)===!0;s.classList.toggle("is-active",i),s.classList.toggle("is-dim",e!==null&&!i)}}function nr(){if(Ee.replaceChildren(),!M||!ie)return;let e=Bn(M.categories,M.used,M.window);if(re){pe.hidden=!1;let u=re,m=e.rows.find((g)=>g.category===u),h=Vn(M.items,u),A=document.createElement("div");A.className="drill-head";let O=document.createElement("div");O.className="drill-title";let J=document.createElement("span");J.className="swatch",J.style.background=`var(--cat-${u})`;let V=document.createElement("span");V.textContent=ke[u],O.append(J,V);let z=document.createElement("div");if(z.className="drill-meta",z.textContent=m?`${G(m.items)} 条 · ${G(m.tokens)} tokens`:`${G(h.length)} 条`,A.append(O,z),Ee.append(A),h.length===0){let g=document.createElement("div");g.className="drill-empty",g.textContent="这个分类没有可列出的条目。",Ee.append(g);return}for(let g of h){let j=document.createElement("div");j.className="item-row";let Z=document.createElement("div");Z.className="item-title",Z.textContent=g.title||"未命名条目",Z.title=g.title;let ae=document.createElement("div");ae.className="item-meta",ae.textContent=`${G(g.chars)} 字符`,j.append(Z,ae),Ee.append(j)}return}pe.hidden=!0;let o=document.createElement("div");o.className="breakdown-list";for(let u of e.rows){let m=document.createElement("button");m.type="button",m.className="row";let h=document.createElement("span");h.className="swatch",h.style.background=`var(--cat-${u.category})`;let A=document.createElement("span");A.className="row-name",A.textContent=ke[u.category];let O=document.createElement("span");O.className="row-meta",O.textContent=`${G(u.items)} 条 · ${G(u.tokens)} tokens`,m.append(h,A,O),m.addEventListener("click",()=>$o(u.category)),o.append(m)}let r=document.createElement("div");r.className="row row-free";let s=document.createElement("span");s.className="swatch",s.style.background="var(--cat-free)";let i=document.createElement("span");i.className="row-name",i.textContent="Free space";let a=document.createElement("span");a.className="row-meta";let T=St(M.used,M.window);a.textContent=T.over?`${G(T.free)} tokens · 已超出窗口`:`${G(T.free)} tokens`,a.classList.toggle("is-over",T.over),r.append(s,i,a),o.append(r),Ee.append(o)}function Vr(e){Ve.hidden=!0,Ie.hidden=!1,ue.hidden=!1,Me.hidden=!1,ht.textContent=e.model,ht.title=e.model,Qn.textContent=G(e.used),Co.textContent=G(e.window);let o=e.window>0?e.used/e.window*100:0;wo.textContent=`${tr(o)}%`,Lr.update({value:o,tone:o>=85?"error":o>=60?"warning":"primary",label:"已用"}),He.hidden=!e.estimated,Xe.hidden=!e.windowAssumed;let r=Dr(e);if(r===xt)return;if(xt=r,Xr(e),re&&(!ie||ie.cellsByCategory[re].length===0))re=null;nr(),or()}function Ho(e){return typeof e==="object"&&e!==null&&!Array.isArray(e)}function Ue(e){return typeof e==="number"&&Number.isFinite(e)}function zr(e){return typeof e==="string"&&oe.includes(e)}function jr(e){if(!Ho(e))return!1;return zr(e.category)&&Ue(e.items)&&Ue(e.chars)&&Ue(e.tokens)}function Wr(e){if(!Ho(e))return!1;return typeof e.id==="string"&&typeof e.title==="string"&&typeof e.head==="string"&&Ue(e.chars)}function Kr(e){try{let o=JSON.parse(e);if(!Ho(o)||typeof o.sessionID!=="string"||typeof o.model!=="string"||!Ue(o.used)||!Ue(o.window)||typeof o.windowAssumed!=="boolean"||typeof o.estimated!=="boolean"||typeof o.collectedAt!=="string"||!Array.isArray(o.categories)||!o.categories.every(jr)||!Array.isArray(o.items)||!o.items.every(Wr))return null;return o}catch{return null}}function rr(e){let o=de?.id??null;if(de=e,(e?.id??null)===o)return;M=null,ne=!1,re=null,xt=null,ie=null,bt.clear(),B=null,H=null,Ot(),Tt()}async function Jr(){let e=de;if(!e){M=null,ne=!1;return}let o=e.id;try{let r=await At.serviceRequest({method:"GET",path:"/summary",query:{sessionID:o}});if(de?.id!==o)return;if(r.status===200){let s=Kr(r.body);M=s,ne=s===null;return}M=null,ne=r.status!==404}catch{if(de?.id!==o)return;M=null,ne=!0}}var _o=!1;async function ho(){if(_o)return;_o=!0;try{let e=await At.serviceRequest({method:"GET",path:"/health"}),o=null;try{o=JSON.parse(e.body)}catch{o=null}if(e.status!==200||!o?.collector){Re=!1,M=null,ne=!1,$e({kind:"failed",title:"本地 Service 返回了意外结果",detail:"请稍后重试，或重新加载面板。"}),Tt();return}let r=o.collector;if(r.connected===!0&&typeof r.version==="string")Re=!0,$e({kind:"connected",version:r.version});else Re=!1,M=null,ne=!1,$e({kind:"disconnected",reason:r.reason==="unreachable"?"unreachable":"not_found"});if(Re)await Jr();To=!0,Tt()}catch(e){Re=!1,M=null,ne=!1,To=!0,$e({kind:"failed",...Pr(e)}),Tt()}finally{_o=!1}}var go=!1;At.onSession((e)=>{let o=de?.id??null;if(rr(e),go&&(e?.id??null)!==o)ho()});At.onReady((e)=>{if(oo(e,document.documentElement),rr(e.session),go)return;go=!0,ho(),setInterval(()=>{ho()},Mr)});})();
