import puppeteer from '/root/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[], errors=[];mkdirSync('evidence',{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function check(name,pass,detail){results.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name,JSON.stringify(detail??''));}
try {
for(const [label,width,height,touch] of [['desktop',1280,720,false],['portrait',390,844,true],['landscape',844,390,true]]) {
 const page=await browser.newPage();await page.setViewport({width,height,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(label+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(label+': '+m.text());});
 await page.goto('http://127.0.0.1:8288/',{waitUntil:'load'});await page.waitForFunction(()=>window.__lastDawn);
 const ev=(fn,...args)=>page.evaluate(fn,...args);
 const d=async code=>ev(code=>{const d=window.__lastDawn.debug;return eval(code)},code);
 const pos=()=>d('({x:d.player.state.x,z:d.player.state.z})');
 const client=await page.createCDPSession();
 const tick=async(seconds=.15)=>{const t=await d('d.G.time');await page.waitForFunction((t,s)=>window.__lastDawn.debug.G.time>=t+s,{timeout:60000},t,seconds);};
 const tickMs=ms=>tick(ms/1000);
 const point=async selector=>ev(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},selector);
 async function tap(s){const p=await point(s);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await tickMs(100);}
 async function hold(s,ms){const p=await point(s);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await tickMs(ms);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tickMs(100);}
 check(label+' title fits',await ev(()=>[...document.querySelectorAll('#title h1,#title .controls,#startbtn')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));
 await page.screenshot({path:`evidence/${label}-title.png`});await tap('#startbtn');check(label+' begin',await d("d.G.state==='playing'"));
 check(label+' renderer',await d('d.renderer.camera.isPerspectiveCamera && d.renderer.renderer.shadowMap.enabled && d.renderer.renderer.info.render.triangles>100'));
 await d('d.G.phaseT=999');
 if(touch){
 check(label+' controls nonoverlap',await ev(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();const a=rect('.bars');return ['#stick','#touchActions','#buildbar'].every(s=>{const b=rect(s);return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;});}));
 const p=await point('#stick'),before=await pos();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y-30,id:1}]});await tickMs(450);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await pos();check(label+' joystick moves screen up',after.x<before.x&&after.z<before.z,{before,after});
 await d('d.player.setPosition(0,4);d.player.state.facing=0');
 } else {
 for(const key of ['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']){const before=await pos();await page.keyboard.down(key);await tickMs(180);await page.keyboard.up(key);const after=await pos();check('desktop '+key+' moves',Math.hypot(after.x-before.x,after.z-before.z)>.1);}
 const yaw=await d('d.renderer.cam.yaw');await page.mouse.move(600,300);await page.mouse.down({button:'right'});await page.mouse.move(700,300,{steps:4});await page.mouse.up({button:'right'});await tickMs(100);check('desktop orbit',Math.abs(await d('d.renderer.cam.yaw')-yaw)>.1);
 const dist=await d('d.renderer.cam.dist');await page.mouse.wheel({deltaY:100});await tickMs(100);check('desktop zoom',await d('d.renderer.cam.dist')>dist);
 }
 // Stage reachable resource positions; actions are real keyboard or CDP touch events.
 await d("const n=d.nodes.find(n=>n.kind==='tree');d.player.setPosition(n.x+.2,n.z);n.rich=5;d.player.state.harvestCd=0;d._wood=d.G.resources.wood");
 if(touch)await hold('#touchGather',1450);else{await page.keyboard.down('e');await tickMs(1450);await page.keyboard.up('e');}
 check(label+' sustained gathering',await d('d.G.resources.wood-d._wood>=6'),await d('d.G.resources.wood-d._wood'));
 const wood=await d('d.G.resources.wood');await tickMs(650);check(label+' gather release stops',await d('d.G.resources.wood')===wood);
 await d('d.player.setPosition(0,4);d.player.state.facing=0;d.G.resources={wood:50,stone:50,essence:50}');await tickMs(200);
 if(touch)await tap('[data-build="wall"]');else await page.keyboard.press('1');await tickMs(100);
 if(touch)await tap('#touchAttack');else {const p=await d('const v=new THREE.Vector3(5,0,5).project(d.renderer.camera);({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2})');await page.mouse.click(p.x,p.y);await tickMs(100);}
 check(label+' build paid once',await d("d.buildings.structures.length===1&&d.G.resources.wood===46&&d.G.resources.stone===48"),await d('d.buildings.structures.map(s=>({kind:s.kind,x:s.x,z:s.z}))'));
 if(touch)await tap('[data-build="wall"]');else{await page.mouse.click(600,300,{button:'right'});await tickMs(100);}
 check(label+' cancel selection',await d('d.ui.selectedBuild===null'));
 await d("d.player.setPosition(10,10);d.player.state.facing=0;const e=d.spawn('brute',10,11.4);e.speed=0;d._enemy=e;");await tickMs(150);
 if(touch)await hold('#touchAttack',1600);else {const p=await d('const v=new THREE.Vector3(10,0,11.4).project(d.renderer.camera);({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2})');for(let i=0;i<4;i++){await page.mouse.click(p.x,p.y);await tickMs(450);}}
 check(label+' strike kills and scores',await d('d._enemy.dead&&d.G.kills===1&&d.G.score>0'),await d('({hp:d._enemy.hp,kills:d.G.kills})'));
 await tap('#mutebtn');check(label+' mute',await d('d.G.muted'));await tap('#mutebtn');check(label+' unmute',await d('!d.G.muted'));
 await tap('#pausebtn');const timer=await d('d.G.phaseT'),pausedPos=await pos();await tickMs(250);check(label+' pause freezes',await d("d.G.state==='paused'")&&timer===await d('d.G.phaseT'));
 await tap('#resumebtn');check(label+' resume',await d("d.G.state==='playing'"));
 if(touch){const p=await point('#stick');await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x+30,y:p.y,id:1}]});await tickMs(100);await ev(()=>window.dispatchEvent(new Event('blur')));await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await tap('#resumebtn');const a=await pos();await tickMs(200);const b=await pos();check(label+' interrupted stick releases',a.x===b.x&&a.z===b.z&&await d('d.input.movementVector()===null'));}
 else {await page.keyboard.down('w');await page.keyboard.press('p');await tickMs(100);await page.keyboard.up('w');await page.keyboard.press('Escape');await tickMs(100);check('desktop pause keyboard reset',await d("d.G.state==='playing'&&d.input.movementVector()===null"));}
 await d('d.player.setPosition(0,4)');await tickMs(400);await page.screenshot({path:`evidence/${label}-play.png`});
 await d('d.forceLose()');await tickMs(100);check(label+' loss UI',await ev(()=>document.querySelector('#verdict').textContent==='THE EMBER DIES'));
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.click('#restartbtn')]);await page.waitForFunction(()=>window.__lastDawn?.debug.G.state==='title');check(label+' restart resets',await d('d.G.kills===0&&d.buildings.structures.length===0'));
 await page.close();
}
check('no browser errors',errors.length===0,errors);
}finally{await browser.close();writeFileSync('evidence/controls-report.json',JSON.stringify({results,errors},null,2));}
console.log(`${results.filter(x=>x.pass).length}/${results.length}`);process.exitCode=results.some(x=>!x.pass)?1:0;
