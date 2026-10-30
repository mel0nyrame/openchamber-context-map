(()=>{var p="openchamber.sdk",u=1;var Ve=`
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
`;function Wt(e){let r=e.documentElement;if(r.hasAttribute("data-oc-scrollbar-activity"))return;r.setAttribute("data-oc-scrollbar-activity","");let i=new WeakMap;e.addEventListener("scroll",(b)=>{let _=b.target===e?r:b.target;if(!(_ instanceof Element))return;if(!_.hasAttribute("data-oc-scrolling"))_.setAttribute("data-oc-scrolling","");let y=i.get(_);if(y!==void 0)clearTimeout(y);i.set(_,setTimeout(()=>{i.delete(_),_.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var $o=`(${Wt.toString()})(document);`;var ze=128,je=65536;var he=128;var xe=65536;var Qt=/^[a-z][a-z0-9-]{0,39}$/;var Kt=(e)=>Object(e)===e&&!Array.isArray(e),We=(e,r)=>Object.keys(e).every((i)=>r.includes(i)),Jt=(e)=>String(e)===e&&e.length>=1&&e.length<=60,Yt=(e)=>String(e)===e&&e.length>=1&&e.length<=80,Zt=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let r=new Set;for(let i of e){if(!Kt(i)||!Qt.test(i.id)||!Jt(i.label))return!1;if(i.disabled!==void 0&&i.disabled!==!0&&i.disabled!==!1)return!1;if(r.has(i.id))return!1;if(r.add(i.id),i.kind==="button"){if(!We(i,["kind","id","label","disabled"]))return!1;continue}if(i.kind!=="select"||!We(i,["kind","id","label","value","options","disabled"]))return!1;if(!Yt(i.value)||!Array.isArray(i.options)||i.options.length<1||i.options.length>16)return!1;let b=new Set;for(let _ of i.options){if(!Kt(_)||!We(_,["value","label"])||!Yt(_.value)||!Jt(_.label)||b.has(_.value))return!1;b.add(_.value)}if(!b.has(i.value))return!1}return!0};var Oe=20000000,Ae=256;var Ke=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,qt=(e,r)=>{if(e.path!==r.path||e.readOnly!==r.readOnly)return!1;if(e.encoding==="text"||r.encoding==="text")return e.encoding==="text"&&r.encoding==="text"&&e.content===r.content;if(e.bytes.byteLength!==r.bytes.byteLength)return!1;for(let i=0;i<e.bytes.byteLength;i+=1)if(e.bytes[i]!==r.bytes[i])return!1;return!0};var eo=/^[A-Za-z0-9_-]{1,80}$/;var to=["left","right","top","bottom"];var oo=(e,r=0,i={remaining:16000})=>{if(--i.remaining<0||r>=32)return!1;if(e===null)return!0;let b=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let _ of b)if(!oo(_,r+1,i))return!1;return!0},Je=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((r)=>/^(0|[1-9]\d*)$/.test(r)&&Number(r)<e.length)&&e.every(Je);if(Object(e)===e){let r=Object.getPrototypeOf(e);return(r===null||r===Object.prototype)&&Object.values(e).every(Je)}return String(e)===e||Number.isFinite(e)},Ye=(e)=>{try{if(String(e.id)!==e.id||!eo.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!to.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!oo(e.data)||!Je(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var no=["file","directory","other","missing"],Ze=(e)=>Boolean(e&&"sessionId"in e),qe=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var so=/^[0-9a-f]{7,64}$/i,et=(e)=>so.test(e),be=500,ge=32000,io=16000,ao=128,co=200,lo=2000,po=16000,uo=80,_o=200,Eo=16000;var So=2000;var tt=20000,ke=1024,Re=2000000;var ye=64000,Ue=8000,ot=4000;var rt=960000;var To=999,fo=1e4,de=500,mo=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],ho=["stopped","starting","ready","failed"],Bo=new Set(mo),xo=(e)=>Bo.has(e),Oo=(e)=>e&&xo(e)?e:"HOST_REJECTED",J=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(J);if(Object(e)===e)return Object.values(e).every(J);return!1},Ao=(e)=>J(e)&&JSON.stringify(e).length<=Eo,ro=(e)=>e?.trim().slice(0,_o)??"",Y=(e)=>{let r=e.id.trim().slice(0,ao),i=e.title.trim().slice(0,co),b=e.url.trim().slice(0,lo),_=e.text?.trim().slice(0,po),y=e.author?.trim().slice(0,uo),X=e.kind==="pull"?"pull":"issue",L={providerId:e.providerId.trim(),id:r,title:i||r,url:b,kind:X};if(_)L.text=_;if(y)L.author=y;if(X==="pull"){let H=ro(e.branches?.head),F=ro(e.branches?.base);if(H&&F)L.branches={head:H,base:F}}if(Ao(e.data))L.data=e.data;return L},nt=(e)=>{let r=Y(e);if(e.projectId)r.projectId=e.projectId;if(e.navigation)r.navigation=e.navigation;if(e.worktree)r.worktree=e.worktree;return r},st=(e)=>{let r={text:e.text.trim().slice(0,io)};if(e.send)r.send=!0;return r},it=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(To,Math.max(0,Math.round(e)))},at=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(fo,Math.max(0,Math.ceil(e)))};var Q=(e)=>e.length>0&&e.length<=ke&&!e.includes("\x00")&&!e.includes("\\");var Ce=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>So)return!1;return!e.split("/").some((i)=>i==="."||i==="..")},Vo=new Set(ho),ct=(e)=>Boolean(e&&"status"in e&&Vo.has(String(e.status))&&!("body"in e)),ve=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),dt=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),lt=(e)=>Boolean(e&&"written"in e&&e.written===!0),pt=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),zo=new Set(no),ut=(e)=>Boolean(e&&"kind"in e&&"size"in e&&zo.has(String(e.kind))&&Number.isFinite(e.size)),_t=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),jo=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late"]),Wo=(e)=>Object(e)===e?e:null,Qe=(e)=>String(e)===e&&e.length>0,Ko=(e)=>{if(!Qe(e.id))return null;if(e.ok===!0){let r={channel:p,v:u,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)r.payload=e.payload;return r}if(e.ok===!1&&Qe(e.error))return{channel:p,v:u,type:"result",id:e.id,ok:!1,error:e.error,code:Oo(Qe(e.code)?e.code:void 0)};return null},Et=(e)=>{let r=Wo(e);if(!r||r.channel!==p||r.v!==u)return null;if(r.type==="result")return Ko(r);if(!jo.has(String(r.type))||Object(r.payload)!==r.payload)return null;return r};var bo=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Jo=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class a extends Error{code;constructor(e,r){super(r);this.name="HostRequestError",this.code=e}}var go=()=>Promise.reject(new a("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),Ie=()=>Promise.reject(new a("BAD_PATH",`File path must be 1 to ${ke} characters without NUL or backslash.`)),Le=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new a("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},l=(e)=>(e.value+=1,`oc-${e.value}`),St=(e={})=>{let r=e.target??("window"in globalThis?window:null);if(!r)throw new a("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let i=e.acceptSource??((t)=>t===r.parent),b=e.requestTimeoutMs??tt,_=new Set,y=new Set,X=new Set,L=new Set,H=new Set,F=new Set,oe=new Set,ue=new Set,_e=new Set,z=new Set,Xe=[],re=null,ne=null,Ee=new Set,Se=new Set,se=null,ie=null,He=!1,j=new Map,W=new Map,K=new Map,M=!1,d={value:0},c=null,N=null,ae=!1,ce=!1,Nt=null,Gt=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},v=(t)=>{r.parent.postMessage(t,"*")},Pt=()=>{if(M||r.parent===r||z.size===0||c?.features?.lateGenerateResults!==!0)return;v({channel:p,v:u,type:"generate-late-listen"})},m=(t,o)=>{for(let n of t)try{n(o)}catch(s){console.error(s)}},Dt=(t)=>{if(!(t instanceof MessageEvent))return;if(!i(t.source))return;let o=Et(t.data);if(!o)return;if(o.type==="workspace"){let s=W.get(o.payload.subscriptionId);if(s)m([s],o.payload.snapshot);return}if(o.type==="shells"){let s=K.get(o.payload.subscriptionId);if(s)m([s],o.payload.snapshot);return}if(o.type==="ready"){if(c=o.payload,N=Gt(o.payload.session),m(_,o.payload),m(y,o.payload.directory),m(X,o.payload.session),N)m(L,N);m(H,o.payload.connection),m(F,o.payload.settings),m(oe,o.payload.item),Pt();return}if(o.type==="generate-late"){if(z.size===0)Xe.push(o.payload);else m(z,o.payload);return}if(o.type==="directory"){if(c)c={...c,directory:o.payload.directory};m(y,o.payload.directory);return}if(o.type==="session"){if(c)c={...c,session:o.payload.session};if(!o.payload.session)N=null;else if(N?.sessionId!==o.payload.session.id)N=Gt(o.payload.session);m(X,o.payload.session);return}if(o.type==="session-lifecycle"){N=o.payload,m(L,o.payload);return}if(o.type==="connection"){if(c)c={...c,connection:o.payload.connection};m(H,o.payload.connection);return}if(o.type==="settings"){if(c)c={...c,settings:o.payload.settings};m(F,o.payload.settings);return}if(o.type==="item"){if(c)c={...c,item:o.payload.item};m(oe,o.payload.item);return}if(o.type==="status-control-event"){m(ue,o.payload);return}if(o.type==="popover-closed"){m(_e,o.payload);return}if(o.type==="action"){let s=(E)=>{if(!M)v({channel:p,v:u,type:"action-result",id:o.id,payload:E})},S=ne;if(!S){s({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>S(o.payload)).then(()=>s({ok:!0}),(E)=>{let A=(E instanceof Error?E.message:String(E)).trim();s({ok:!1,error:(A||"Action failed.").slice(0,de)})});return}if(o.type==="file-open"){let s=o.payload;if(ie&&qt(ie,s))return;ie=s,m(Ee,o.payload);return}if(o.type==="file-saved"){m(Se,o.payload.version);return}if(o.type==="file-snapshot"){let s=(A)=>{if(!M)v({channel:p,v:u,type:"file-snapshot-result",id:o.id,payload:A})},S=(A)=>s({error:(A.trim()||"Could not read the edited file.").slice(0,de)}),E=se;if(!E){S("This extension does not edit files.");return}Promise.resolve().then(()=>E(o.payload.purpose)).then((A)=>{if(Ke(A)>Oe){S(`The file is over ${Oe} ${"bytes"in A?"bytes":"characters"}.`);return}if(A.version.length>Ae){S(`The snapshot version is over ${Ae} characters.`);return}s({snapshot:"bytes"in A?{bytes:A.bytes,version:A.version}:{content:A.content,version:A.version}})},(A)=>S(A instanceof Error?A.message:String(A)));return}if(o.type==="resolve"){let s=(E)=>{v({channel:p,v:u,type:"resolve-result",id:o.id,payload:E})},S=re;if(!S){s({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>S(o.payload)).then((E)=>s({item:E?Y(E):null}),(E)=>{let A=(E instanceof Error?E.message:String(E)).trim();s({error:(A||"Command failed.").slice(0,de)})});return}let n=j.get(o.id);if(!n)return;if(clearTimeout(n.timer),j.delete(o.id),o.ok){n.resolve(o.payload);return}n.reject(new a(o.code,o.error))};r.addEventListener("message",Dt),v({channel:p,v:u,type:"hello"});let g=(t,o=b)=>{if(M||r.parent===r)return Promise.reject(new a("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((n,s)=>{let S=setTimeout(()=>{j.delete(t.id),s(new a("HOST_TIMEOUT","Host did not answer in time."))},o);j.set(t.id,{resolve:n,reject:s,timer:S}),v(t)})},x=(t)=>g(t).then(()=>{return}),O={channel:p,v:u},$e=(t)=>{if(!M&&r.parent!==r)v(t)},Xt=()=>$e({...O,type:"file-save"}),Ht=(t)=>{if(!bo(t)||!Jo(t))return;t.preventDefault(),Xt()},$t=(t)=>{if(!bo(t)||t.key!=="Escape"||c?.surface!=="popover"||!c.popover)return;t.preventDefault(),zt(c.popover.id,"escape").catch(()=>{return})},Te=()=>{let t=c?.surface==="popover"?c.popover:void 0;if(!t)return;let o=ae||ce;if(Nt===o)return;Nt=o,jt(t.id,o).catch(()=>{return})},fe=()=>{if(c?.surface!=="popover"||ae)return;ae=!0,Te()},Ft=(t)=>{if(c?.surface!=="popover"||t.relatedTarget!==null||!ae)return;ae=!1,Te()},Bt=()=>{if(c?.surface!=="popover"||ce)return;ce=!0,Te()},Vt=()=>{if(c?.surface!=="popover"||!ce)return;ce=!1,Te()},w=(t,o=1024)=>{if(!t.trim()||t.length>o)throw new a("HOST_REJECTED",`Identity must contain 1 to ${o} characters.`)},Fe=async(t)=>{if(t.kind!=="projects")w(t.projectId);let o=await g({...O,type:"workspace-read",id:l(d),payload:t});if(!o||!("kind"in o)||!("state"in o)||o.kind!==t.kind)throw new a("HOST_REJECTED","Host did not return workspace data.");return o},Be=async(t,o)=>{if(t.kind!=="projects")w(t.projectId);let n=l(d);W.set(n,o);try{await x({...O,type:"workspace-subscribe",id:l(d),payload:{subscriptionId:n,query:t}})}catch(s){if(W.delete(n),!M)v({...O,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:n}});throw s}return()=>{if(!W.delete(n)||M)return;v({...O,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:n}})}},Ho=async(t,o)=>{if(t.kind==="session")w(t.sessionId);if(t.kind==="project")w(t.projectId);let n=l(d);K.set(n,o);try{await x({...O,type:"shells-subscribe",id:l(d),payload:{subscriptionId:n,scope:t}})}catch(s){if(K.delete(n),!M)v({...O,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:n}});throw s}return()=>{if(!K.delete(n)||M)return;v({...O,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:n}})}},me=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>ze))throw new a("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!J(t.value))throw new a("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>je)throw new a("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&c?.features?.deviceStorage!==!0)throw new a("UNSUPPORTED","This host does not support device storage.");let o=await g({...O,type:"storage",id:l(d),payload:t});if(!o||!("storage"in o)||o.op!==t.op)throw new a("HOST_REJECTED","Host did not return storage data.");return o},zt=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):x({...O,type:"popover-close",id:l(d),payload:o?{id:t,reason:o}:{id:t}}),jt=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):x({...O,type:"popover-anchor",id:l(d),payload:{id:t,active:o}});return r.addEventListener("keydown",$t,!0),r.addEventListener("pointerover",fe),r.addEventListener("pointermove",fe),r.addEventListener("pointerout",Ft),r.addEventListener("focus",Bt),r.addEventListener("blur",Vt),{onAction:(t)=>(ne=t,()=>{if(ne===t)ne=null}),listProjects:async()=>{let t=await Fe({kind:"projects"});if(t.kind!=="projects")throw new a("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let o=await Fe({kind:"worktrees",projectId:t});if(o.kind!=="worktrees")throw new a("HOST_REJECTED","Expected worktrees.");return o},listSessions:async(t)=>{let o=await Fe({kind:"sessions",projectId:t});if(o.kind!=="sessions")throw new a("HOST_REJECTED","Expected sessions.");return o},onProjects:(t)=>Be({kind:"projects"},(o)=>{if(o.kind==="projects")t(o)}),onWorktrees:(t,o)=>Be({kind:"worktrees",projectId:t},(n)=>{if(n.kind==="worktrees")o(n)}),onSessions:(t,o)=>Be({kind:"sessions",projectId:t},(n)=>{if(n.kind==="sessions")o(n)}),onRunningShells:(t,o)=>Ho(t,o),readShellOutput:async(t,o)=>{w(t,he);let n=o?.cursor;if(n!==void 0&&(!Number.isInteger(n)||n<0))throw new a("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let s=o?.tailBytes;if(s!==void 0&&(!Number.isInteger(s)||s<1||s>xe))throw new a("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${xe}.`);let E=await g({...O,type:"shell-output",id:l(d),payload:{shellId:t,cursor:n,tailBytes:s}});if(!E||typeof E.output!=="string"||!Number.isFinite(E.cursor))throw new a("HOST_REJECTED","Host did not return shell output.");return E},stopShell:async(t)=>{if(w(t,he),(await g({...O,type:"shell-stop",id:l(d),payload:{shellId:t}}))?.stopped!==!0)throw new a("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{w(t),await x({...O,type:"open-session",id:l(d),payload:{sessionId:t}})},storage:{get:async(t,o)=>{let n=Le(o),s={op:"get",key:t};if(n)s.scope=n;let S=await me(s);return S.op==="get"&&S.found?S.value:void 0},set:async(t,o,n)=>{let s=Le(n),S={op:"set",key:t,value:o};if(s)S.scope=s;await me(S)},delete:async(t,o)=>{let n=Le(o),s={op:"delete",key:t};if(n)s.scope=n;await me(s)},keys:async(t)=>{let o=Le(t),n={op:"keys"};if(o)n.scope=o;let s=await me(n);if(s.op!=="keys")throw new a("HOST_REJECTED","Expected storage keys.");return s.keys}},onReady:(t)=>{if(_.add(t),c)t(c);return()=>{_.delete(t)}},onDirectory:(t)=>{if(y.add(t),c)t(c.directory);return()=>{y.delete(t)}},onSession:(t)=>{if(X.add(t),c)t(c.session);return()=>{X.delete(t)}},onSessionLifecycle:(t)=>{if(L.add(t),N)t(N);return()=>{L.delete(t)}},onConnection:(t)=>{if(H.add(t),c)t(c.connection);return()=>{H.delete(t)}},onSettings:(t)=>{if(F.add(t),c)t(c.settings);return()=>{F.delete(t)}},onItem:(t)=>{if(oe.add(t),c)t(c.item);return()=>{oe.delete(t)}},onStatusControl:(t)=>(ue.add(t),()=>{ue.delete(t)}),onPopoverClosed:(t)=>(_e.add(t),()=>{_e.delete(t)}),setStatusControls:(t)=>{if(c?.features?.statusControls!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support status controls."));if(!Zt(t))return Promise.reject(new a("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return x({...O,type:"status-controls",id:l(d),payload:{controls:t}})},openPopover:(t)=>{if(c?.features?.popovers!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support popovers."));if(!Ye(t))return Promise.reject(new a("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return x({...O,type:"popover-open",id:l(d),payload:t})},closePopover:zt,setPopoverAnchorActive:jt,onResolve:(t)=>(re=t,()=>{if(re===t)re=null}),toast:(t)=>{let o=t.message.trim();if(!o||o.length>be)return Promise.reject(new a("HOST_REJECTED",`Toast message must contain 1 to ${be} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>ge))return Promise.reject(new a("HOST_REJECTED",`Toast copy text must contain 1 to ${ge} characters.`));return x({channel:p,v:u,type:"toast",id:l(d),payload:{...t,message:o}})},openUrl:(t)=>x({channel:p,v:u,type:"open-url",id:l(d),payload:{url:t}}),openCommit:(t)=>et(t)?x({channel:p,v:u,type:"open-commit",id:l(d),payload:{sha:t}}):Promise.reject(new a("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),openSurface:(t)=>x({channel:p,v:u,type:"open-surface",id:l(d),payload:{surfaceId:t}}),writeClipboard:(t)=>x({channel:p,v:u,type:"clipboard-write",id:l(d),payload:{text:t}}),compose:(t)=>x({channel:p,v:u,type:"compose",id:l(d),payload:t}),attach:(t)=>x({channel:p,v:u,type:"attach",id:l(d),payload:Y(t)}),startSession:async(t)=>{if(t.projectId!==void 0)w(t.projectId);let o=t.worktree;if(o&&o!==!0)if(o.kind==="existing")w(o.directory);else{if(o.name!==void 0)w(o.name,200);if(o.baseBranch!==void 0)w(o.baseBranch,200)}let n=await g({channel:p,v:u,type:"start-session",id:l(d),payload:nt(t)},e.requestTimeoutMs??180000);if(!Ze(n))throw new a("HOST_REJECTED","Host did not return a session.");return n},prompt:(t)=>g({channel:p,v:u,type:"prompt",id:l(d),payload:st(t)}).then((o)=>{if(!qe(o))throw new a("HOST_REJECTED","Host did not return a prompt result.");return o}),sessionLink:(t)=>x({channel:p,v:u,type:"session-link",id:l(d),payload:Y(t)}),close:()=>x({channel:p,v:u,type:"close",id:l(d)}),oauthStart:()=>x({channel:p,v:u,type:"oauth-start",id:l(d)}),oauthDisconnect:()=>x({channel:p,v:u,type:"oauth-disconnect",id:l(d)}),request:(t)=>(Ce(t.path)?g({channel:p,v:u,type:"request",id:l(d),payload:t}):go()).then((o)=>{if(!ve(o))throw new a("HOST_REJECTED","Host request result was empty.");return o}),serviceRequest:(t)=>(Ce(t.path)?g({channel:p,v:u,type:"service-request",id:l(d),payload:t}):go()).then((o)=>{if(!ve(o))throw new a("HOST_REJECTED","Host service request result was empty.");return o}),serviceStatus:()=>g({channel:p,v:u,type:"service-status",id:l(d)}).then((t)=>{if(!ct(t))throw new a("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(Q(t)?g({channel:p,v:u,type:"file-read",id:l(d),payload:{path:t}}):Ie()).then((o)=>{if(!dt(o))throw new a("HOST_REJECTED","Host did not return file content.");return o}),writeFile:(t,o)=>{if(!Q(t))return Ie();if(o.length>Re)return Promise.reject(new a("FILE_TOO_LARGE",`Content is over ${Re} characters.`));return g({channel:p,v:u,type:"file-write",id:l(d),payload:{path:t,content:o}}).then((n)=>{if(!lt(n))throw new a("HOST_REJECTED","Host did not confirm the write.");return n})},listDir:(t)=>(Q(t)?g({channel:p,v:u,type:"file-list",id:l(d),payload:{path:t}}):Ie()).then((o)=>{if(!pt(o))throw new a("HOST_REJECTED","Host did not return directory entries.");return o}),stat:(t)=>(Q(t)?g({channel:p,v:u,type:"file-stat",id:l(d),payload:{path:t}}):Ie()).then((o)=>{if(!ut(o))throw new a("HOST_REJECTED","Host did not return file status.");return o}),generate:(t)=>{let o=t.prompt.trim(),n=t.system?.trim();if(o.length===0||o.length>ye)return Promise.reject(new a("HOST_REJECTED",`Prompt must be 1 to ${ye} characters.`));if(n!==void 0&&(n.length===0||n.length>Ue))return Promise.reject(new a("HOST_REJECTED",`System prompt must be 1 to ${Ue} characters.`));let s=t.maxOutputTokens===void 0?void 0:Math.min(ot,Math.max(1,Math.floor(t.maxOutputTokens)));if(s!==void 0&&!Number.isFinite(s))return Promise.reject(new a("HOST_REJECTED","maxOutputTokens must be a number."));let S={prompt:o};if(n!==void 0)S.system=n;if(s!==void 0)S.maxOutputTokens=s;return g({channel:p,v:u,type:"generate",id:l(d),payload:S},e.requestTimeoutMs??rt).then((E)=>{if(!_t(E))throw new a("HOST_REJECTED","Host did not return generated text.");return E})},onLateGenerateResult:(t)=>{z.add(t);for(let o of Xe.splice(0))m([t],o);return Pt(),()=>{z.delete(t)}},setBadge:(t)=>x({channel:p,v:u,type:"badge",id:l(d),payload:{count:it(t)}}),setHeight:(t)=>x({channel:p,v:u,type:"resize",id:l(d),payload:{height:at(t)}}),onFileOpen:(t)=>{if(Ee.add(t),!He)He=!0,r.addEventListener("keydown",Ht,!0);if(ie)t(ie);return()=>{Ee.delete(t)}},onFileSnapshot:(t)=>(se=t,()=>{if(se===t)se=null}),onFileSaved:(t)=>(Se.add(t),()=>{Se.delete(t)}),reportFileChange:(t)=>$e({...O,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:Xt,reportFileUnsupported:()=>$e({...O,type:"file-unsupported"}),dispose:()=>{for(let t of W.keys())v({...O,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:t}});W.clear();for(let t of K.keys())v({...O,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:t}});if(K.clear(),M=!0,re=null,ne=null,se=null,Ee.clear(),Se.clear(),He)r.removeEventListener("keydown",Ht,!0);r.removeEventListener("message",Dt),r.removeEventListener("keydown",$t,!0),r.removeEventListener("pointerover",fe),r.removeEventListener("pointermove",fe),r.removeEventListener("pointerout",Ft),r.removeEventListener("focus",Bt),r.removeEventListener("blur",Vt);for(let t of j.values())clearTimeout(t.timer),t.reject(new a("HOST_UNAVAILABLE","Host client was disposed."));j.clear(),_.clear(),y.clear(),X.clear(),L.clear(),H.clear(),F.clear(),oe.clear(),ue.clear(),_e.clear(),z.clear(),Xe.length=0}}};var ko=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var wr=new Set(ko);var Ro=["none","agent","user"];var Nr=new Set(Ro);var Yo=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],Qo=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],yo=(e,r)=>{r.style.colorScheme=e.mode;for(let[i,b]of Yo)r.style.setProperty(i,e.tokens[b]);for(let[i,b,_]of Qo){let y=e.tokens[_]??"";r.style.setProperty(i,y),r.style.setProperty(b,y)}r.style.setProperty("font-family",e.tokens.font),r.style.setProperty("font-size","0.875rem"),r.style.setProperty("line-height","1.45"),r.style.setProperty("color",e.tokens.foreground)},Tt=(e,r)=>{if(yo(e.theme,r),r.dataset)r.dataset.ocSurface=e.surface,r.dataset.ocTheme=e.theme.mode};var Zo={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},f=(e,r)=>`var(--${e}, var(--oc-${Zo[e]}, ${r}))`,P=f("surface-background","transparent"),Me=f("surface-elevated","transparent"),Z=f("surface-elevated-foreground","inherit"),I=f("surface-foreground","inherit"),T=f("surface-muted-foreground","gray"),qo=f("surface-muted","transparent"),B=f("interactive-border","currentColor"),k=f("interactive-hover","transparent"),V=f("interactive-active","transparent"),ft=f("interactive-selection","transparent"),mt=f("interactive-selection-foreground","inherit"),G=f("primary","currentColor"),ht=f("primary-text","inherit"),xt=f("error-text","inherit"),er=f("font-sans","inherit"),Ot=f("font-mono","monospace"),Lo=f("radius","9px"),At=`calc(${Lo} - 2px)`,Uo=`calc(${Lo} - 4px)`,h=(e,r,i="transparent")=>`color-mix(in srgb, ${e} ${r}%, ${i})`,Co=`background-image: linear-gradient(${k}, ${k});`,bt=(e)=>`box-shadow: inset 0 0 0 1px ${e}, var(--oc-sdk-field-lift);`,gt="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",vo="box-shadow: var(--oc-sdk-lit);",Io=`inset 0 1px 0 0 ${h(I,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2)`,tr=`
:root {
  --oc-sdk-edge: ${h(I,10)};
  --oc-sdk-field-bg: ${Me};
  --oc-sdk-raised-bg: ${P};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 2px 0 rgb(0 0 0 / 0.06);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.45), 0 1px 2px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.1);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.8), inset 0 0 0 1px rgb(0 0 0 / 0.04), 0 1px 2px -0.5px rgb(0 0 0 / 0.08), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.08);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${h(I,6)};
  --oc-sdk-field-bg: ${h(P,50,Me)};
  --oc-sdk-raised-bg: ${Me};
  --oc-sdk-field-lift: ${Io};
  --oc-sdk-raised-lift: ${Io};
  --oc-sdk-lit: inset 0 1px 0 0 ${h(I,1.5)}, 0 1px 1px 0 rgb(0 0 0 / 0.28), 0 2px 3px -2px rgb(0 0 0 / 0.2);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.36);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.06), inset 0 0 0 1px rgb(255 255 255 / 0.08), 0 1px 1px -0.5px rgb(0 0 0 / 0.22), 0 3px 3px -1.5px rgb(0 0 0 / 0.2), 0 6px 6px -3px rgb(0 0 0 / 0.16);
}`,we=(e)=>{let r=f(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${r}; --oc-sdk-tone-text: ${f(`${e}-text`,"inherit")}; }`},or=`
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
`,wo=`${tr}
.oc-sdk { color: ${I}; font-family: ${er}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${Co} }
.oc-sdk-mono { font-family: ${Ot}; }
.oc-sdk-muted { color: ${T}; }
${we("success")}${we("warning")}${we("error")}${we("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${G}; --oc-sdk-tone-text: ${ht}; }

.oc-sdk-btn { border-radius: ${At}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Uo}; }
.oc-sdk-btn[data-variant="default"] { color: ${ht}; background: ${h(G,10,P)}; border-color: ${h(G,12)}; ${vo} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${h(G,16,P)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${h(G,22,P)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${qo}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${k}, ${k}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${Z}; ${gt} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${k}, ${k}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${V}, ${V}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${k}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${V}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${f("status-error","red")}; color: ${xt}; background: ${h("var(--oc-sdk-tone)",7,P)}; border-color: ${h("var(--oc-sdk-tone)",12)}; ${vo} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${h("var(--oc-sdk-tone)",9,P)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${h("var(--oc-sdk-tone)",11,P)}; box-shadow: none; }

.oc-sdk-field-note { color: ${T}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${xt}; }
.oc-sdk-input { border-radius: ${At}; background: var(--oc-sdk-field-bg); color: ${Z}; ${bt("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${T}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${k}, ${k}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${bt(h(I,26))} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${bt(f("status-error","red"))} }
.oc-sdk-input[data-mono="true"] { font-family: ${Ot}; }

.oc-sdk-search-icon { color: ${T}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${G}; }
.oc-sdk-search-clear { border-radius: ${Uo}; color: ${T}; }
.oc-sdk-search-clear:hover { background: ${k}; color: ${I}; }

.oc-sdk-trigger { border-radius: ${At}; background: var(--oc-sdk-raised-bg); color: ${Z}; ${gt} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${k}, ${k}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${T}; }
.oc-sdk-trigger-chevron { color: ${T}; }
/* The app's dropdown light: lit top, hairline rings and a layered shadow. Its outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${Z}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${Me}; background-clip: padding-box; color: ${Z}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${k}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${ft}; color: ${mt}; }
.oc-sdk-option-check { color: ${I}; }
.oc-sdk-option[data-destructive="true"] { color: ${xt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${h(f("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${T}; }
.oc-sdk-popup-empty { color: ${T}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${B}; border-radius: 4px; color: ${I}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${h(I,60,B)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${B}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${P}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${G}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${Co} }
.oc-sdk-check-desc { color: ${T}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${h(I,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${T}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${I}; }
.oc-sdk-tab[aria-selected="true"] { color: ${mt}; background: ${ft}; border-color: ${B}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${Z}; background: var(--oc-sdk-raised-bg); ${gt} }
.oc-sdk-tab-count { color: ${T}; }

.oc-sdk-badge { border-radius: 9999px; background: ${k}; color: ${T}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${h("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${k}; }
.oc-sdk-row[aria-selected="true"] { background: ${ft}; color: ${mt}; }
.oc-sdk-row-lead { font-family: ${Ot}; color: ${T}; }
.oc-sdk-row-sub { color: ${T}; }
.oc-sdk-row-meta { color: ${T}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${T}; }

.oc-sdk-empty-body { color: ${T}; }

.oc-sdk-spinner { color: ${T}; }
.oc-sdk-spinner-ring { border-color: ${B}; border-top-color: ${G}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${h("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${T}; }

.oc-sdk-separator { color: ${T}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${h(B,40)}; }

.oc-sdk-progress-label { color: ${T}; }
.oc-sdk-progress-track { border-radius: 9999px; background: ${B}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${G}); }

.oc-sdk-text a { color: ${ht}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${h(B,60)}; }
`,R=`
${Ve}
${or}
${wo}`;var ar=2000,cr=`
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
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
`,Go=St(),Po=document.querySelector("#root");if(!Po)throw Error("Missing #root");var Do=document.createElement("style");Do.textContent=cr;document.head.append(Do);var Ut=document.createElement("div");Ut.className="head";var Ct=document.createElement("div");Ct.className="title";Ct.textContent="Context Map";var vt=document.createElement("div");vt.className="subtitle";vt.textContent="最后一次请求的上下文构成";Ut.append(Ct,vt);var pe=document.createElement("div");pe.className="status";pe.dataset.state="checking";var Xo=document.createElement("span");Xo.className="dot";var It=document.createElement("div");It.className="status-text";var ee=document.createElement("div");ee.className="status-title";var te=document.createElement("div");te.className="status-detail";It.append(ee,te);pe.append(Xo,It);var Lt=document.createElement("div");Lt.className="placeholder";var wt=document.createElement("div");wt.className="placeholder-title";wt.textContent="还没有上下文快照";var Mt=document.createElement("div");Mt.className="placeholder-detail";Mt.textContent="发起一次请求后，这里会显示最后一次请求的构成。";Lt.append(wt,Mt);Po.append(Ut,pe,Lt);le({kind:"checking"});function dr(e){return e.startsWith("v")?e:`v${e}`}function le(e){if(pe.dataset.state=e.kind,e.kind==="checking"){ee.textContent="正在连接本地 Service…",te.textContent="首次打开面板时，Service 可能需要一点时间启动。";return}if(e.kind==="connected"){ee.textContent=`Collector 已连接 · ${dr(e.version)}`,te.textContent="快照会通过本地 Service 读取，bearer 不会进入面板。";return}if(e.kind==="disconnected"){ee.textContent="Collector 未连接",te.textContent=e.reason==="not_found"?"未找到采集器。启动 OpenCode 后会自动连接。":"采集器没有响应。重启 OpenCode 后再试。";return}ee.textContent=e.title,te.textContent=e.detail}function lr(e){if(e instanceof a){if(e.code==="NO_SERVICE"||e.code==="NOT_GRANTED")return{title:"本地 Service 未连接",detail:"在设置 → 扩展中允许 Context Map 的本地服务。"};if(e.code==="DISABLED")return{title:"Context Map 已暂停",detail:"在设置 → 扩展中重新启用。"};if(e.code==="SERVICE_FAILED")return{title:"本地 Service 已停止",detail:"它会在下次刷新时自动重启。"}}return{title:"无法连接本地 Service",detail:"请确认 OpenChamber 正在运行。"}}var yt=!1;async function Mo(){if(yt)return;yt=!0;try{let e=await Go.serviceRequest({method:"GET",path:"/health"}),r=null;try{r=JSON.parse(e.body)}catch{r=null}if(e.status!==200||!r?.collector){le({kind:"failed",title:"本地 Service 返回了意外结果",detail:"请稍后重试，或重新加载面板。"});return}let i=r.collector;if(i.connected===!0&&typeof i.version==="string"){le({kind:"connected",version:i.version});return}le({kind:"disconnected",reason:i.reason==="unreachable"?"unreachable":"not_found"})}catch(e){let r=lr(e);le({kind:"failed",...r})}finally{yt=!1}}var No=!1;Go.onReady((e)=>{if(Tt(e,document.documentElement),No)return;No=!0,Mo(),setInterval(()=>{Mo()},ar)});})();
