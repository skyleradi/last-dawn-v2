import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { rmSync } from 'node:fs';
const CHROME=process.env.CHROME_BIN, profile='/tmp/ld2-smoke'; rmSync(profile,{recursive:true,force:true});
const chrome=spawn(CHROME,['--headless=new','--remote-debugging-port=9341',`--user-data-dir=${profile}`,'--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844','about:blank'],{stdio:'ignore'});
let end; for(let i=0;i<50;i++){try{let j=await(await fetch('http://127.0.0.1:9341/json/version')).json();if(j.webSocketDebuggerUrl){end=j.webSocketDebuggerUrl;break}}catch{} await sleep(100)}
const ws=new WebSocket(end); await new Promise(r=>ws.addEventListener('open',r,{once:true})); let id=0; const pending=new Map(); ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&pending.has(d.id)){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(new Error(JSON.stringify(d.error))):p.resolve(d.result)}};
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,sessionId}))})}
const {targetId}=await send('Target.createTarget',{url:'about:blank'}); const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true}); await send('Runtime.enable',{},sessionId); await send('Page.navigate',{url:'http://127.0.0.1:8288/index.html'},sessionId); await sleep(1800);
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true},sessionId);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const out=[]; const check=(n,v,d='')=>{out.push([n,!!v,d]);console.log(`${v?'PASS':'FAIL'} ${n}${d?' -> '+d:''}`)};
check('3D renderer active',await ev("!!window.__lastDawn.debug.renderer.renderer && window.__lastDawn.debug.renderer.scene.children.length>10"));
await ev("document.getElementById('startbtn').click()"); await sleep(300);
check('mobile controls present',await ev("['stick','touchGather','touchAttack'].every(id=>!!document.getElementById(id))"));
check('mobile layout fits',await ev("document.documentElement.scrollWidth<=innerWidth+1 && document.documentElement.scrollHeight<=innerHeight+1"));
check('game entered playing',await ev("window.__lastDawn.debug.G.state==='playing'"));
const before=await ev("window.__lastDawn.debug.G.resources.wood");
await ev("(()=>{const d=window.__lastDawn.debug; const n=d.nodes.find(x=>x.userData.kind==='tree'); d.player.setPosition(n.position.x+1,n.position.z); d.input.state.touchGather=true})()"); await sleep(700);
check('touch gather changes resources',await ev("window.__lastDawn.debug.G.resources.wood>"+before),`${before} -> ${await ev('window.__lastDawn.debug.G.resources.wood')}`);
await ev("window.__lastDawn.debug.G.resources.wood=30;window.__lastDawn.debug.G.resources.stone=30;window.__lastDawn.debug.ui.selectBuild('wall');window.__lastDawn.debug.renderer.setMouseNdc(0,0)");
const count=await ev('window.__lastDawn.debug.buildings.structures.length');
await ev("window.__lastDawn.debug.state='playing'");
check('building API available',await ev("typeof window.__lastDawn.debug.buildings.placeBuild==='function'"));
await ev("window.__lastDawn.debug.forceNight()"); check('day/night transition works',await ev("window.__lastDawn.debug.G.phase==='night'"));
console.log('SUMMARY',out.filter(x=>x[1]).length+'/'+out.length); ws.close(); chrome.kill('SIGTERM'); process.exit(out.some(x=>!x[1])?1:0);
