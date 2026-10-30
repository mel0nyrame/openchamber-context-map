(()=>{var p="openchamber.sdk",u=1;var rt=`
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
`;function st(e){let n=e.documentElement;if(n.hasAttribute("data-oc-scrollbar-activity"))return;n.setAttribute("data-oc-scrollbar-activity","");let r=new WeakMap;e.addEventListener("scroll",(_)=>{let E=_.target===e?n:_.target;if(!(E instanceof Element))return;if(!E.hasAttribute("data-oc-scrolling"))E.setAttribute("data-oc-scrolling","");let R=r.get(E);if(R!==void 0)clearTimeout(R);r.set(E,setTimeout(()=>{r.delete(E),E.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var _n=`(${st.toString()})(document);`;var it=128,at=65536;var ve=128;var Ce=65536;var Ao=/^[a-z][a-z0-9-]{0,39}$/;var ho=(e)=>Object(e)===e&&!Array.isArray(e),ct=(e,n)=>Object.keys(e).every((r)=>n.includes(r)),xo=(e)=>String(e)===e&&e.length>=1&&e.length<=60,Oo=(e)=>String(e)===e&&e.length>=1&&e.length<=80,bo=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let n=new Set;for(let r of e){if(!ho(r)||!Ao.test(r.id)||!xo(r.label))return!1;if(r.disabled!==void 0&&r.disabled!==!0&&r.disabled!==!1)return!1;if(n.has(r.id))return!1;if(n.add(r.id),r.kind==="button"){if(!ct(r,["kind","id","label","disabled"]))return!1;continue}if(r.kind!=="select"||!ct(r,["kind","id","label","value","options","disabled"]))return!1;if(!Oo(r.value)||!Array.isArray(r.options)||r.options.length<1||r.options.length>16)return!1;let _=new Set;for(let E of r.options){if(!ho(E)||!ct(E,["value","label"])||!Oo(E.value)||!xo(E.label)||_.has(E.value))return!1;_.add(E.value)}if(!_.has(r.value))return!1}return!0};var Ie=20000000,we=256;var dt=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,go=(e,n)=>{if(e.path!==n.path||e.readOnly!==n.readOnly)return!1;if(e.encoding==="text"||n.encoding==="text")return e.encoding==="text"&&n.encoding==="text"&&e.content===n.content;if(e.bytes.byteLength!==n.bytes.byteLength)return!1;for(let r=0;r<e.bytes.byteLength;r+=1)if(e.bytes[r]!==n.bytes[r])return!1;return!0};var ko=/^[A-Za-z0-9_-]{1,80}$/;var Ro=["left","right","top","bottom"];var yo=(e,n=0,r={remaining:16000})=>{if(--r.remaining<0||n>=32)return!1;if(e===null)return!0;let _=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let E of _)if(!yo(E,n+1,r))return!1;return!0},lt=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((n)=>/^(0|[1-9]\d*)$/.test(n)&&Number(n)<e.length)&&e.every(lt);if(Object(e)===e){let n=Object.getPrototypeOf(e);return(n===null||n===Object.prototype)&&Object.values(e).every(lt)}return String(e)===e||Number.isFinite(e)},pt=(e)=>{try{if(String(e.id)!==e.id||!ko.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!Ro.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!yo(e.data)||!lt(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var vo=["file","directory","other","missing"],Et=(e)=>Boolean(e&&"sessionId"in e),_t=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var Co=/^[0-9a-f]{7,64}$/i,ft=(e)=>Co.test(e),Ne=500,Le=32000,Io=16000,wo=128,No=200,Lo=2000,Mo=16000,Go=80,Po=200,Do=16000;var Ho=2000;var St=20000,Me=1024,Ge=2000000;var Pe=64000,De=8000,Tt=4000;var mt=960000;var Xo=999,$o=1e4,Se=500,Fo=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],Bo=["stopped","starting","ready","failed"],Sn=new Set(Fo),Vo=(e)=>Sn.has(e),zo=(e)=>e&&Vo(e)?e:"HOST_REJECTED",q=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(q);if(Object(e)===e)return Object.values(e).every(q);return!1},jo=(e)=>q(e)&&JSON.stringify(e).length<=Do,Uo=(e)=>e?.trim().slice(0,Po)??"",ee=(e)=>{let n=e.id.trim().slice(0,wo),r=e.title.trim().slice(0,No),_=e.url.trim().slice(0,Lo),E=e.text?.trim().slice(0,Mo),R=e.author?.trim().slice(0,Go),M=e.kind==="pull"?"pull":"issue",A={providerId:e.providerId.trim(),id:n,title:r||n,url:_,kind:M};if(E)A.text=E;if(R)A.author=R;if(M==="pull"){let N=Uo(e.branches?.head),G=Uo(e.branches?.base);if(N&&G)A.branches={head:N,base:G}}if(jo(e.data))A.data=e.data;return A},ht=(e)=>{let n=ee(e);if(e.projectId)n.projectId=e.projectId;if(e.navigation)n.navigation=e.navigation;if(e.worktree)n.worktree=e.worktree;return n},xt=(e)=>{let n={text:e.text.trim().slice(0,Io)};if(e.send)n.send=!0;return n},Ot=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(Xo,Math.max(0,Math.round(e)))},At=(e)=>{if(!Number.isFinite(e))return 0;return Math.min($o,Math.max(0,Math.ceil(e)))};var te=(e)=>e.length>0&&e.length<=Me&&!e.includes("\x00")&&!e.includes("\\");var He=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>Ho)return!1;return!e.split("/").some((r)=>r==="."||r==="..")},Tn=new Set(Bo),bt=(e)=>Boolean(e&&"status"in e&&Tn.has(String(e.status))&&!("body"in e)),Xe=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),gt=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),kt=(e)=>Boolean(e&&"written"in e&&e.written===!0),Rt=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),mn=new Set(vo),yt=(e)=>Boolean(e&&"kind"in e&&"size"in e&&mn.has(String(e.kind))&&Number.isFinite(e.size)),Ut=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),hn=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late"]),xn=(e)=>Object(e)===e?e:null,ut=(e)=>String(e)===e&&e.length>0,On=(e)=>{if(!ut(e.id))return null;if(e.ok===!0){let n={channel:p,v:u,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)n.payload=e.payload;return n}if(e.ok===!1&&ut(e.error))return{channel:p,v:u,type:"result",id:e.id,ok:!1,error:e.error,code:zo(ut(e.code)?e.code:void 0)};return null},vt=(e)=>{let n=xn(e);if(!n||n.channel!==p||n.v!==u)return null;if(n.type==="result")return On(n);if(!hn.has(String(n.type))||Object(n.payload)!==n.payload)return null;return n};var Wo=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),An=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class a extends Error{code;constructor(e,n){super(n);this.name="HostRequestError",this.code=e}}var Ko=()=>Promise.reject(new a("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),$e=()=>Promise.reject(new a("BAD_PATH",`File path must be 1 to ${Me} characters without NUL or backslash.`)),Fe=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new a("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},l=(e)=>(e.value+=1,`oc-${e.value}`),Ct=(e={})=>{let n=e.target??("window"in globalThis?window:null);if(!n)throw new a("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let r=e.acceptSource??((t)=>t===n.parent),_=e.requestTimeoutMs??St,E=new Set,R=new Set,M=new Set,A=new Set,N=new Set,G=new Set,P=new Set,Ae=new Set,be=new Set,J=new Set,qe=[],le=null,pe=null,ge=new Set,ke=new Set,ue=null,Ee=null,et=!1,Y=new Map,Q=new Map,Z=new Map,X=!1,d={value:0},c=null,F=null,_e=!1,fe=!1,io=null,ao=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},I=(t)=>{n.parent.postMessage(t,"*")},co=()=>{if(X||n.parent===n||J.size===0||c?.features?.lateGenerateResults!==!0)return;I({channel:p,v:u,type:"generate-late-listen"})},x=(t,o)=>{for(let s of t)try{s(o)}catch(i){console.error(i)}},lo=(t)=>{if(!(t instanceof MessageEvent))return;if(!r(t.source))return;let o=vt(t.data);if(!o)return;if(o.type==="workspace"){let i=Q.get(o.payload.subscriptionId);if(i)x([i],o.payload.snapshot);return}if(o.type==="shells"){let i=Z.get(o.payload.subscriptionId);if(i)x([i],o.payload.snapshot);return}if(o.type==="ready"){if(c=o.payload,F=ao(o.payload.session),x(E,o.payload),x(R,o.payload.directory),x(M,o.payload.session),F)x(A,F);x(N,o.payload.connection),x(G,o.payload.settings),x(P,o.payload.item),co();return}if(o.type==="generate-late"){if(J.size===0)qe.push(o.payload);else x(J,o.payload);return}if(o.type==="directory"){if(c)c={...c,directory:o.payload.directory};x(R,o.payload.directory);return}if(o.type==="session"){if(c)c={...c,session:o.payload.session};if(!o.payload.session)F=null;else if(F?.sessionId!==o.payload.session.id)F=ao(o.payload.session);x(M,o.payload.session);return}if(o.type==="session-lifecycle"){F=o.payload,x(A,o.payload);return}if(o.type==="connection"){if(c)c={...c,connection:o.payload.connection};x(N,o.payload.connection);return}if(o.type==="settings"){if(c)c={...c,settings:o.payload.settings};x(G,o.payload.settings);return}if(o.type==="item"){if(c)c={...c,item:o.payload.item};x(P,o.payload.item);return}if(o.type==="status-control-event"){x(Ae,o.payload);return}if(o.type==="popover-closed"){x(be,o.payload);return}if(o.type==="action"){let i=(f)=>{if(!X)I({channel:p,v:u,type:"action-result",id:o.id,payload:f})},S=pe;if(!S){i({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>S(o.payload)).then(()=>i({ok:!0}),(f)=>{let k=(f instanceof Error?f.message:String(f)).trim();i({ok:!1,error:(k||"Action failed.").slice(0,Se)})});return}if(o.type==="file-open"){let i=o.payload;if(Ee&&go(Ee,i))return;Ee=i,x(ge,o.payload);return}if(o.type==="file-saved"){x(ke,o.payload.version);return}if(o.type==="file-snapshot"){let i=(k)=>{if(!X)I({channel:p,v:u,type:"file-snapshot-result",id:o.id,payload:k})},S=(k)=>i({error:(k.trim()||"Could not read the edited file.").slice(0,Se)}),f=ue;if(!f){S("This extension does not edit files.");return}Promise.resolve().then(()=>f(o.payload.purpose)).then((k)=>{if(dt(k)>Ie){S(`The file is over ${Ie} ${"bytes"in k?"bytes":"characters"}.`);return}if(k.version.length>we){S(`The snapshot version is over ${we} characters.`);return}i({snapshot:"bytes"in k?{bytes:k.bytes,version:k.version}:{content:k.content,version:k.version}})},(k)=>S(k instanceof Error?k.message:String(k)));return}if(o.type==="resolve"){let i=(f)=>{I({channel:p,v:u,type:"resolve-result",id:o.id,payload:f})},S=le;if(!S){i({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>S(o.payload)).then((f)=>i({item:f?ee(f):null}),(f)=>{let k=(f instanceof Error?f.message:String(f)).trim();i({error:(k||"Command failed.").slice(0,Se)})});return}let s=Y.get(o.id);if(!s)return;if(clearTimeout(s.timer),Y.delete(o.id),o.ok){s.resolve(o.payload);return}s.reject(new a(o.code,o.error))};n.addEventListener("message",lo),I({channel:p,v:u,type:"hello"});let v=(t,o=_)=>{if(X||n.parent===n)return Promise.reject(new a("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((s,i)=>{let S=setTimeout(()=>{Y.delete(t.id),i(new a("HOST_TIMEOUT","Host did not answer in time."))},o);Y.set(t.id,{resolve:s,reject:i,timer:S}),I(t)})},b=(t)=>v(t).then(()=>{return}),g={channel:p,v:u},tt=(t)=>{if(!X&&n.parent!==n)I(t)},po=()=>tt({...g,type:"file-save"}),uo=(t)=>{if(!Wo(t)||!An(t))return;t.preventDefault(),po()},Eo=(t)=>{if(!Wo(t)||t.key!=="Escape"||c?.surface!=="popover"||!c.popover)return;t.preventDefault(),To(c.popover.id,"escape").catch(()=>{return})},Re=()=>{let t=c?.surface==="popover"?c.popover:void 0;if(!t)return;let o=_e||fe;if(io===o)return;io=o,mo(t.id,o).catch(()=>{return})},ye=()=>{if(c?.surface!=="popover"||_e)return;_e=!0,Re()},_o=(t)=>{if(c?.surface!=="popover"||t.relatedTarget!==null||!_e)return;_e=!1,Re()},fo=()=>{if(c?.surface!=="popover"||fe)return;fe=!0,Re()},So=()=>{if(c?.surface!=="popover"||!fe)return;fe=!1,Re()},D=(t,o=1024)=>{if(!t.trim()||t.length>o)throw new a("HOST_REJECTED",`Identity must contain 1 to ${o} characters.`)},ot=async(t)=>{if(t.kind!=="projects")D(t.projectId);let o=await v({...g,type:"workspace-read",id:l(d),payload:t});if(!o||!("kind"in o)||!("state"in o)||o.kind!==t.kind)throw new a("HOST_REJECTED","Host did not return workspace data.");return o},nt=async(t,o)=>{if(t.kind!=="projects")D(t.projectId);let s=l(d);Q.set(s,o);try{await b({...g,type:"workspace-subscribe",id:l(d),payload:{subscriptionId:s,query:t}})}catch(i){if(Q.delete(s),!X)I({...g,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:s}});throw i}return()=>{if(!Q.delete(s)||X)return;I({...g,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:s}})}},En=async(t,o)=>{if(t.kind==="session")D(t.sessionId);if(t.kind==="project")D(t.projectId);let s=l(d);Z.set(s,o);try{await b({...g,type:"shells-subscribe",id:l(d),payload:{subscriptionId:s,scope:t}})}catch(i){if(Z.delete(s),!X)I({...g,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:s}});throw i}return()=>{if(!Z.delete(s)||X)return;I({...g,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:s}})}},Ue=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>it))throw new a("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!q(t.value))throw new a("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>at)throw new a("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&c?.features?.deviceStorage!==!0)throw new a("UNSUPPORTED","This host does not support device storage.");let o=await v({...g,type:"storage",id:l(d),payload:t});if(!o||!("storage"in o)||o.op!==t.op)throw new a("HOST_REJECTED","Host did not return storage data.");return o},To=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):b({...g,type:"popover-close",id:l(d),payload:o?{id:t,reason:o}:{id:t}}),mo=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):b({...g,type:"popover-anchor",id:l(d),payload:{id:t,active:o}});return n.addEventListener("keydown",Eo,!0),n.addEventListener("pointerover",ye),n.addEventListener("pointermove",ye),n.addEventListener("pointerout",_o),n.addEventListener("focus",fo),n.addEventListener("blur",So),{onAction:(t)=>(pe=t,()=>{if(pe===t)pe=null}),listProjects:async()=>{let t=await ot({kind:"projects"});if(t.kind!=="projects")throw new a("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let o=await ot({kind:"worktrees",projectId:t});if(o.kind!=="worktrees")throw new a("HOST_REJECTED","Expected worktrees.");return o},listSessions:async(t)=>{let o=await ot({kind:"sessions",projectId:t});if(o.kind!=="sessions")throw new a("HOST_REJECTED","Expected sessions.");return o},onProjects:(t)=>nt({kind:"projects"},(o)=>{if(o.kind==="projects")t(o)}),onWorktrees:(t,o)=>nt({kind:"worktrees",projectId:t},(s)=>{if(s.kind==="worktrees")o(s)}),onSessions:(t,o)=>nt({kind:"sessions",projectId:t},(s)=>{if(s.kind==="sessions")o(s)}),onRunningShells:(t,o)=>En(t,o),readShellOutput:async(t,o)=>{D(t,ve);let s=o?.cursor;if(s!==void 0&&(!Number.isInteger(s)||s<0))throw new a("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let i=o?.tailBytes;if(i!==void 0&&(!Number.isInteger(i)||i<1||i>Ce))throw new a("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${Ce}.`);let f=await v({...g,type:"shell-output",id:l(d),payload:{shellId:t,cursor:s,tailBytes:i}});if(!f||typeof f.output!=="string"||!Number.isFinite(f.cursor))throw new a("HOST_REJECTED","Host did not return shell output.");return f},stopShell:async(t)=>{if(D(t,ve),(await v({...g,type:"shell-stop",id:l(d),payload:{shellId:t}}))?.stopped!==!0)throw new a("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{D(t),await b({...g,type:"open-session",id:l(d),payload:{sessionId:t}})},storage:{get:async(t,o)=>{let s=Fe(o),i={op:"get",key:t};if(s)i.scope=s;let S=await Ue(i);return S.op==="get"&&S.found?S.value:void 0},set:async(t,o,s)=>{let i=Fe(s),S={op:"set",key:t,value:o};if(i)S.scope=i;await Ue(S)},delete:async(t,o)=>{let s=Fe(o),i={op:"delete",key:t};if(s)i.scope=s;await Ue(i)},keys:async(t)=>{let o=Fe(t),s={op:"keys"};if(o)s.scope=o;let i=await Ue(s);if(i.op!=="keys")throw new a("HOST_REJECTED","Expected storage keys.");return i.keys}},onReady:(t)=>{if(E.add(t),c)t(c);return()=>{E.delete(t)}},onDirectory:(t)=>{if(R.add(t),c)t(c.directory);return()=>{R.delete(t)}},onSession:(t)=>{if(M.add(t),c)t(c.session);return()=>{M.delete(t)}},onSessionLifecycle:(t)=>{if(A.add(t),F)t(F);return()=>{A.delete(t)}},onConnection:(t)=>{if(N.add(t),c)t(c.connection);return()=>{N.delete(t)}},onSettings:(t)=>{if(G.add(t),c)t(c.settings);return()=>{G.delete(t)}},onItem:(t)=>{if(P.add(t),c)t(c.item);return()=>{P.delete(t)}},onStatusControl:(t)=>(Ae.add(t),()=>{Ae.delete(t)}),onPopoverClosed:(t)=>(be.add(t),()=>{be.delete(t)}),setStatusControls:(t)=>{if(c?.features?.statusControls!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support status controls."));if(!bo(t))return Promise.reject(new a("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return b({...g,type:"status-controls",id:l(d),payload:{controls:t}})},openPopover:(t)=>{if(c?.features?.popovers!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support popovers."));if(!pt(t))return Promise.reject(new a("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return b({...g,type:"popover-open",id:l(d),payload:t})},closePopover:To,setPopoverAnchorActive:mo,onResolve:(t)=>(le=t,()=>{if(le===t)le=null}),toast:(t)=>{let o=t.message.trim();if(!o||o.length>Ne)return Promise.reject(new a("HOST_REJECTED",`Toast message must contain 1 to ${Ne} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>Le))return Promise.reject(new a("HOST_REJECTED",`Toast copy text must contain 1 to ${Le} characters.`));return b({channel:p,v:u,type:"toast",id:l(d),payload:{...t,message:o}})},openUrl:(t)=>b({channel:p,v:u,type:"open-url",id:l(d),payload:{url:t}}),openCommit:(t)=>ft(t)?b({channel:p,v:u,type:"open-commit",id:l(d),payload:{sha:t}}):Promise.reject(new a("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),openSurface:(t)=>b({channel:p,v:u,type:"open-surface",id:l(d),payload:{surfaceId:t}}),writeClipboard:(t)=>b({channel:p,v:u,type:"clipboard-write",id:l(d),payload:{text:t}}),compose:(t)=>b({channel:p,v:u,type:"compose",id:l(d),payload:t}),attach:(t)=>b({channel:p,v:u,type:"attach",id:l(d),payload:ee(t)}),startSession:async(t)=>{if(t.projectId!==void 0)D(t.projectId);let o=t.worktree;if(o&&o!==!0)if(o.kind==="existing")D(o.directory);else{if(o.name!==void 0)D(o.name,200);if(o.baseBranch!==void 0)D(o.baseBranch,200)}let s=await v({channel:p,v:u,type:"start-session",id:l(d),payload:ht(t)},e.requestTimeoutMs??180000);if(!Et(s))throw new a("HOST_REJECTED","Host did not return a session.");return s},prompt:(t)=>v({channel:p,v:u,type:"prompt",id:l(d),payload:xt(t)}).then((o)=>{if(!_t(o))throw new a("HOST_REJECTED","Host did not return a prompt result.");return o}),sessionLink:(t)=>b({channel:p,v:u,type:"session-link",id:l(d),payload:ee(t)}),close:()=>b({channel:p,v:u,type:"close",id:l(d)}),oauthStart:()=>b({channel:p,v:u,type:"oauth-start",id:l(d)}),oauthDisconnect:()=>b({channel:p,v:u,type:"oauth-disconnect",id:l(d)}),request:(t)=>(He(t.path)?v({channel:p,v:u,type:"request",id:l(d),payload:t}):Ko()).then((o)=>{if(!Xe(o))throw new a("HOST_REJECTED","Host request result was empty.");return o}),serviceRequest:(t)=>(He(t.path)?v({channel:p,v:u,type:"service-request",id:l(d),payload:t}):Ko()).then((o)=>{if(!Xe(o))throw new a("HOST_REJECTED","Host service request result was empty.");return o}),serviceStatus:()=>v({channel:p,v:u,type:"service-status",id:l(d)}).then((t)=>{if(!bt(t))throw new a("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(te(t)?v({channel:p,v:u,type:"file-read",id:l(d),payload:{path:t}}):$e()).then((o)=>{if(!gt(o))throw new a("HOST_REJECTED","Host did not return file content.");return o}),writeFile:(t,o)=>{if(!te(t))return $e();if(o.length>Ge)return Promise.reject(new a("FILE_TOO_LARGE",`Content is over ${Ge} characters.`));return v({channel:p,v:u,type:"file-write",id:l(d),payload:{path:t,content:o}}).then((s)=>{if(!kt(s))throw new a("HOST_REJECTED","Host did not confirm the write.");return s})},listDir:(t)=>(te(t)?v({channel:p,v:u,type:"file-list",id:l(d),payload:{path:t}}):$e()).then((o)=>{if(!Rt(o))throw new a("HOST_REJECTED","Host did not return directory entries.");return o}),stat:(t)=>(te(t)?v({channel:p,v:u,type:"file-stat",id:l(d),payload:{path:t}}):$e()).then((o)=>{if(!yt(o))throw new a("HOST_REJECTED","Host did not return file status.");return o}),generate:(t)=>{let o=t.prompt.trim(),s=t.system?.trim();if(o.length===0||o.length>Pe)return Promise.reject(new a("HOST_REJECTED",`Prompt must be 1 to ${Pe} characters.`));if(s!==void 0&&(s.length===0||s.length>De))return Promise.reject(new a("HOST_REJECTED",`System prompt must be 1 to ${De} characters.`));let i=t.maxOutputTokens===void 0?void 0:Math.min(Tt,Math.max(1,Math.floor(t.maxOutputTokens)));if(i!==void 0&&!Number.isFinite(i))return Promise.reject(new a("HOST_REJECTED","maxOutputTokens must be a number."));let S={prompt:o};if(s!==void 0)S.system=s;if(i!==void 0)S.maxOutputTokens=i;return v({channel:p,v:u,type:"generate",id:l(d),payload:S},e.requestTimeoutMs??mt).then((f)=>{if(!Ut(f))throw new a("HOST_REJECTED","Host did not return generated text.");return f})},onLateGenerateResult:(t)=>{J.add(t);for(let o of qe.splice(0))x([t],o);return co(),()=>{J.delete(t)}},setBadge:(t)=>b({channel:p,v:u,type:"badge",id:l(d),payload:{count:Ot(t)}}),setHeight:(t)=>b({channel:p,v:u,type:"resize",id:l(d),payload:{height:At(t)}}),onFileOpen:(t)=>{if(ge.add(t),!et)et=!0,n.addEventListener("keydown",uo,!0);if(Ee)t(Ee);return()=>{ge.delete(t)}},onFileSnapshot:(t)=>(ue=t,()=>{if(ue===t)ue=null}),onFileSaved:(t)=>(ke.add(t),()=>{ke.delete(t)}),reportFileChange:(t)=>tt({...g,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:po,reportFileUnsupported:()=>tt({...g,type:"file-unsupported"}),dispose:()=>{for(let t of Q.keys())I({...g,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:t}});Q.clear();for(let t of Z.keys())I({...g,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:t}});if(Z.clear(),X=!0,le=null,pe=null,ue=null,ge.clear(),ke.clear(),et)n.removeEventListener("keydown",uo,!0);n.removeEventListener("message",lo),n.removeEventListener("keydown",Eo,!0),n.removeEventListener("pointerover",ye),n.removeEventListener("pointermove",ye),n.removeEventListener("pointerout",_o),n.removeEventListener("focus",fo),n.removeEventListener("blur",So);for(let t of Y.values())clearTimeout(t.timer),t.reject(new a("HOST_UNAVAILABLE","Host client was disposed."));Y.clear(),E.clear(),R.clear(),M.clear(),A.clear(),N.clear(),G.clear(),P.clear(),Ae.clear(),be.clear(),J.clear(),qe.length=0}}};var Jo=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var pr=new Set(Jo);var Yo=["none","agent","user"];var Er=new Set(Yo);var bn=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],gn=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],Qo=(e,n)=>{n.style.colorScheme=e.mode;for(let[r,_]of bn)n.style.setProperty(r,e.tokens[_]);for(let[r,_,E]of gn){let R=e.tokens[E]??"";n.style.setProperty(r,R),n.style.setProperty(_,R)}n.style.setProperty("font-family",e.tokens.font),n.style.setProperty("font-size","0.875rem"),n.style.setProperty("line-height","1.45"),n.style.setProperty("color",e.tokens.foreground)},It=(e,n)=>{if(Qo(e.theme,n),n.dataset)n.dataset.ocSurface=e.surface,n.dataset.ocTheme=e.theme.mode};var kn={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},m=(e,n)=>`var(--${e}, var(--oc-${kn[e]}, ${n}))`,V=m("surface-background","transparent"),Ve=m("surface-elevated","transparent"),oe=m("surface-elevated-foreground","inherit"),L=m("surface-foreground","inherit"),T=m("surface-muted-foreground","gray"),Rn=m("surface-muted","transparent"),j=m("interactive-border","currentColor"),C=m("interactive-hover","transparent"),K=m("interactive-active","transparent"),wt=m("interactive-selection","transparent"),Nt=m("interactive-selection-foreground","inherit"),B=m("primary","currentColor"),Lt=m("primary-text","inherit"),Mt=m("error-text","inherit"),yn=m("font-sans","inherit"),Gt=m("font-mono","monospace"),on=m("radius","9px"),Pt=`calc(${on} - 2px)`,Zo=`calc(${on} - 4px)`,O=(e,n,r="transparent")=>`color-mix(in srgb, ${e} ${n}%, ${r})`,qo=`background-image: linear-gradient(${C}, ${C});`,Dt=(e)=>`box-shadow: inset 0 0 0 1px ${e}, var(--oc-sdk-field-lift);`,Ht="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",en="box-shadow: var(--oc-sdk-lit);",tn=`inset 0 1px 0 0 ${O(L,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2)`,Un=`
:root {
  --oc-sdk-edge: ${O(L,10)};
  --oc-sdk-field-bg: ${Ve};
  --oc-sdk-raised-bg: ${V};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 2px 0 rgb(0 0 0 / 0.06);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.45), 0 1px 2px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.1);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.8), inset 0 0 0 1px rgb(0 0 0 / 0.04), 0 1px 2px -0.5px rgb(0 0 0 / 0.08), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.08);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${O(L,6)};
  --oc-sdk-field-bg: ${O(V,50,Ve)};
  --oc-sdk-raised-bg: ${Ve};
  --oc-sdk-field-lift: ${tn};
  --oc-sdk-raised-lift: ${tn};
  --oc-sdk-lit: inset 0 1px 0 0 ${O(L,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.36);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.06), inset 0 0 0 1px rgb(255 255 255 / 0.08), 0 1px 1px -0.5px rgb(0 0 0 / 0.22), 0 3px 3px -1.5px rgb(0 0 0 / 0.2), 0 6px 6px -3px rgb(0 0 0 / 0.16);
}`,Be=(e)=>{let n=m(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${n}; --oc-sdk-tone-text: ${m(`${e}-text`,"inherit")}; }`},vn=`
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
`,nn=`${Un}
.oc-sdk { color: ${L}; font-family: ${yn}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${qo} }
.oc-sdk-mono { font-family: ${Gt}; }
.oc-sdk-muted { color: ${T}; }
${Be("success")}${Be("warning")}${Be("error")}${Be("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${B}; --oc-sdk-tone-text: ${Lt}; }

.oc-sdk-btn { border-radius: ${Pt}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Zo}; }
.oc-sdk-btn[data-variant="default"] { color: ${Lt}; background: ${O(B,10,V)}; border-color: ${O(B,12)}; ${en} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${O(B,16,V)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${O(B,22,V)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${Rn}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${C}, ${C}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${K}, ${K}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${oe}; ${Ht} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${C}, ${C}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${K}, ${K}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${C}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${K}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${m("status-error","red")}; color: ${Mt}; background: ${O("var(--oc-sdk-tone)",7,V)}; border-color: ${O("var(--oc-sdk-tone)",12)}; ${en} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${O("var(--oc-sdk-tone)",9,V)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${O("var(--oc-sdk-tone)",11,V)}; box-shadow: none; }

.oc-sdk-field-note { color: ${T}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${Mt}; }
.oc-sdk-input { border-radius: ${Pt}; background: var(--oc-sdk-field-bg); color: ${oe}; ${Dt("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${T}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${C}, ${C}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${Dt(O(L,26))} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${Dt(m("status-error","red"))} }
.oc-sdk-input[data-mono="true"] { font-family: ${Gt}; }

.oc-sdk-search-icon { color: ${T}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${B}; }
.oc-sdk-search-clear { border-radius: ${Zo}; color: ${T}; }
.oc-sdk-search-clear:hover { background: ${C}; color: ${L}; }

.oc-sdk-trigger { border-radius: ${Pt}; background: var(--oc-sdk-raised-bg); color: ${oe}; ${Ht} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${C}, ${C}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${K}, ${K}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${T}; }
.oc-sdk-trigger-chevron { color: ${T}; }
/* The app's dropdown light: lit top, hairline rings and a layered shadow. Its outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${oe}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${Ve}; background-clip: padding-box; color: ${oe}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${C}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${wt}; color: ${Nt}; }
.oc-sdk-option-check { color: ${L}; }
.oc-sdk-option[data-destructive="true"] { color: ${Mt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${O(m("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${T}; }
.oc-sdk-popup-empty { color: ${T}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${j}; border-radius: 4px; color: ${L}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${O(L,60,j)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${j}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${V}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${B}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${qo} }
.oc-sdk-check-desc { color: ${T}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${O(L,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${T}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${L}; }
.oc-sdk-tab[aria-selected="true"] { color: ${Nt}; background: ${wt}; border-color: ${j}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${oe}; background: var(--oc-sdk-raised-bg); ${Ht} }
.oc-sdk-tab-count { color: ${T}; }

.oc-sdk-badge { border-radius: 9999px; background: ${C}; color: ${T}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${O("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${C}; }
.oc-sdk-row[aria-selected="true"] { background: ${wt}; color: ${Nt}; }
.oc-sdk-row-lead { font-family: ${Gt}; color: ${T}; }
.oc-sdk-row-sub { color: ${T}; }
.oc-sdk-row-meta { color: ${T}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${T}; }

.oc-sdk-empty-body { color: ${T}; }

.oc-sdk-spinner { color: ${T}; }
.oc-sdk-spinner-ring { border-color: ${j}; border-top-color: ${B}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${O("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${T}; }

.oc-sdk-separator { color: ${T}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${O(j,40)}; }

.oc-sdk-progress-label { color: ${T}; }
.oc-sdk-progress-track { border-radius: 9999px; background: ${j}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${B}); }

.oc-sdk-text a { color: ${Lt}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${O(j,60)}; }
`,y=`
${rt}
${vn}
${nn}`;var rn="oc-sdk-ui-style";var U=(e)=>{let n=document.getElementById(rn);if(n instanceof HTMLStyleElement){if(n.textContent!==e)n.textContent=e;return}st(document);let r=document.createElement("style");r.id=rn,r.textContent=e,document.head.appendChild(r)},h=(e,n)=>{let r=document.createElement(e);if(n)r.className=n;return r};var w=(e,n)=>{let r=n??"";if(e.textContent!==r)e.textContent=r},ne=(e,n,r)=>{if(r===void 0||r===null||r==="")e.removeAttribute(n);else if(e.getAttribute(n)!==r)e.setAttribute(n,r)};var Ke=(e,n)=>{ne(e,"data-tone",n&&n!=="neutral"?n:null)},Je=(e,n)=>{U(y);let r=n,_=h("span","oc-sdk oc-sdk-badge");e.append(_);let E=()=>{w(_,r.label),Ke(_,r.tone)};return E(),{update:(R)=>{r={...r,...R},E()},dispose:()=>{_.remove()}}};var Nn=(e)=>Number.isFinite(e)?Math.min(100,Math.max(0,Math.round(e))):0,Ft=(e,n)=>{U(y);let r=n,_=h("div","oc-sdk oc-sdk-progress"),E=h("div","oc-sdk-progress-label"),R=h("span"),M=h("span");E.append(R,M);let A=h("div","oc-sdk-progress-track");A.setAttribute("role","progressbar"),A.setAttribute("aria-valuemin","0"),A.setAttribute("aria-valuemax","100");let N=h("div","oc-sdk-progress-fill");A.append(N),_.append(E,A),e.append(_);let G=()=>{let P=Nn(r.value);if(Ke(N,r.tone),N.style.transform=`scaleX(${P/100})`,A.setAttribute("aria-valuenow",String(P)),r.label)A.setAttribute("aria-label",r.label);else A.removeAttribute("aria-label");w(R,r.label),w(M,`${P}%`),E.hidden=!r.label};return G(),{update:(P)=>{r={...r,...P},G()},dispose:()=>{_.remove()}}};var Ln=2000,Mn=`
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .usage { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
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
`,Ze=Ct(),an=document.querySelector("#root");if(!an)throw Error("Missing #root");var cn=document.createElement("style");cn.textContent=Mn;document.head.append(cn);var Wt=document.createElement("div");Wt.className="head";var Kt=document.createElement("div");Kt.className="title";Kt.textContent="Context Map";var Jt=document.createElement("div");Jt.className="subtitle";Jt.textContent="最后一次请求的上下文构成";Wt.append(Kt,Jt);var de=document.createElement("section");de.className="usage";de.hidden=!0;var Yt=document.createElement("div");Yt.className="usage-head";var Qt=document.createElement("div");Qt.className="usage-title";Qt.textContent="Context usage";var Zt=document.createElement("div");Zt.className="usage-badges";var me=document.createElement("span");me.hidden=!0;me.title="部分数字由字符估算，provider 未提供完整 token 用量。";Je(me,{label:"estimated",tone:"warning"});var he=document.createElement("span");he.hidden=!0;he.title="没有取得模型窗口，按 200,000 tokens 估算。";Je(he,{label:"assumed window",tone:"info"});Zt.append(me,he);Yt.append(Qt,Zt);var Qe=document.createElement("div");Qe.className="usage-model";var qt=document.createElement("div");qt.className="usage-meter";var eo=document.createElement("div");eo.className="usage-numbers";var dn=document.createElement("span"),to=document.createElement("span");to.className="usage-window";eo.append(dn,document.createTextNode(" / "),to,document.createTextNode(" tokens"));var oo=document.createElement("div");oo.className="usage-pct";qt.append(eo,oo);var ln=document.createElement("div"),Gn=Ft(ln,{value:0,label:"已用"});de.append(Yt,Qe,qt,ln);var xe=document.createElement("div");xe.className="placeholder";var no=document.createElement("div");no.className="placeholder-title";var ro=document.createElement("div");ro.className="placeholder-detail";xe.append(no,ro);var Oe=document.createElement("div");Oe.className="status";Oe.dataset.state="checking";var pn=document.createElement("span");pn.className="dot";var so=document.createElement("div");so.className="status-text";var ae=document.createElement("div");ae.className="status-title";var ce=document.createElement("div");ce.className="status-detail";so.append(ae,ce);Oe.append(pn,so);an.append(Wt,de,xe,Oe);var W=null,se=!1,Vt=!1,H=null,z=!1;Te({kind:"checking"});ie("正在连接 Collector…","首次打开面板时，本地 Service 可能需要一点时间启动。");function Pn(e){return e.startsWith("v")?e:`v${e}`}function Te(e){if(Oe.dataset.state=e.kind,e.kind==="checking"){ae.textContent="正在连接本地 Service…",ce.textContent="首次打开面板时，Service 可能需要一点时间启动。";return}if(e.kind==="connected"){ae.textContent=`Collector 已连接 · ${Pn(e.version)}`,ce.textContent="快照会通过本地 Service 读取，bearer 不会进入面板。";return}if(e.kind==="disconnected"){ae.textContent="Collector 未连接",ce.textContent=e.reason==="not_found"?"未找到采集器。启动 OpenCode 后会自动连接。":"采集器没有响应。重启 OpenCode 后再试。";return}ae.textContent=e.title,ce.textContent=e.detail}function Dn(e){if(e instanceof a){if(e.code==="NO_SERVICE"||e.code==="NOT_GRANTED")return{title:"本地 Service 未连接",detail:"在设置 → 扩展中允许 Context Map 的本地服务。"};if(e.code==="DISABLED")return{title:"Context Map 已暂停",detail:"在设置 → 扩展中重新启用。"};if(e.code==="SERVICE_FAILED")return{title:"本地 Service 已停止",detail:"它会在下次刷新时自动重启。"}}return{title:"无法连接本地 Service",detail:"请确认 OpenChamber 正在运行。"}}function ie(e,n){de.hidden=!0,xe.hidden=!1,no.textContent=e,ro.textContent=n}function Ye(){if(!Vt){ie("正在连接 Collector…","首次打开面板时，本地 Service 可能需要一点时间启动。");return}if(!W){ie("未打开 session","打开一个 session 后，这里会显示它的上下文占用。");return}if(!se){ie("快照暂不可用","Collector 连接后会自动显示上下文占用。");return}if(z){ie("快照暂时不可用","Collector 没有及时响应，稍后会自动重试。");return}if(!H||H.sessionID!==W.id){ie("还没有上下文快照","发起一次请求后，这里会显示最后一次请求的构成。");return}Xn(H)}function sn(e){return new Intl.NumberFormat("zh-CN").format(e)}function Hn(e){let n=Math.round(e*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1)}function Xn(e){xe.hidden=!0,de.hidden=!1,Qe.textContent=e.model,Qe.title=e.model,dn.textContent=sn(e.used),to.textContent=sn(e.window);let n=e.window>0?e.used/e.window*100:0;oo.textContent=`${Hn(n)}%`,Gn.update({value:n,tone:n>=85?"error":n>=60?"warning":"primary",label:"已用"}),me.hidden=!e.estimated,he.hidden=!e.windowAssumed}function $n(e){try{let n=JSON.parse(e);if(typeof n.sessionID!=="string"||typeof n.model!=="string"||typeof n.used!=="number"||typeof n.window!=="number"||typeof n.windowAssumed!=="boolean"||typeof n.estimated!=="boolean"||typeof n.collectedAt!=="string"||!Array.isArray(n.categories)||!Array.isArray(n.items))return null;return n}catch{return null}}function un(e){let n=W?.id??null;if(W=e,(e?.id??null)===n)return;H=null,z=!1,Ye()}async function Fn(){let e=W;if(!e){H=null,z=!1;return}let n=e.id;try{let r=await Ze.serviceRequest({method:"GET",path:"/summary",query:{sessionID:n}});if(W?.id!==n)return;if(r.status===200){let _=$n(r.body);H=_,z=_===null;return}H=null,z=r.status!==404}catch{if(W?.id!==n)return;H=null,z=!0}}var Bt=!1;async function zt(){if(Bt)return;Bt=!0;try{let e=await Ze.serviceRequest({method:"GET",path:"/health"}),n=null;try{n=JSON.parse(e.body)}catch{n=null}if(e.status!==200||!n?.collector){se=!1,H=null,z=!1,Te({kind:"failed",title:"本地 Service 返回了意外结果",detail:"请稍后重试，或重新加载面板。"}),Ye();return}let r=n.collector;if(r.connected===!0&&typeof r.version==="string")se=!0,Te({kind:"connected",version:r.version});else se=!1,H=null,z=!1,Te({kind:"disconnected",reason:r.reason==="unreachable"?"unreachable":"not_found"});if(se)await Fn();Vt=!0,Ye()}catch(e){se=!1,H=null,z=!1,Vt=!0,Te({kind:"failed",...Dn(e)}),Ye()}finally{Bt=!1}}var jt=!1;Ze.onSession((e)=>{let n=W?.id??null;if(un(e),jt&&(e?.id??null)!==n)zt()});Ze.onReady((e)=>{if(It(e,document.documentElement),un(e.session),jt)return;jt=!0,zt(),setInterval(()=>{zt()},Ln)});})();
