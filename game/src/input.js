// Keyboard and captured pointers share one reset path at interruption boundaries.
export function createInput(dom, canvas) {
  const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch', touch);
  const state = {
    keys: new Set(), justPressed: new Set(), wheel: 0, orbit: 0, touch,
    mouse: { x: 0, y: 0, down: false, justDown: false, rightDown: false, dragging: false, cancel: false },
    touchMove: { x: 0, z: 0 }, touchAttack: false, touchAttackPressed: false, touchGather: false,
  };
  const keys = { KeyW:'up', ArrowUp:'up', KeyS:'down', ArrowDown:'down', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    state.keys.add(keys[e.code] || e.code); state.justPressed.add(e.code);
    if (keys[e.code] || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => state.keys.delete(keys[e.code] || e.code));
  const captures = new Map();
  function capture(el, e) { el.setPointerCapture(e.pointerId); captures.set(e.pointerId, el); }
  function release(id) { const el = captures.get(id); captures.delete(id); if (el?.hasPointerCapture(id)) el.releasePointerCapture(id); }
  function pointerXY(e) {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = (e.clientX-r.left)/r.width*2-1;
    state.mouse.y = 1-(e.clientY-r.top)/r.height*2;
  }
  let lastX = 0;
  canvas.addEventListener('pointermove', e => {
    pointerXY(e);
    if (state.mouse.dragging) state.orbit += (e.clientX-lastX)*0.006;
    lastX=e.clientX;
  });
  canvas.addEventListener('pointerdown', e => {
    pointerXY(e); lastX=e.clientX; capture(canvas,e);
    if(e.button===0) { state.mouse.down=true; state.mouse.justDown=true; }
    if(e.button===2) { state.mouse.rightDown=true; state.mouse.dragging=true; state.mouse.cancel=true; }
  });
  function endMouse(e) { release(e.pointerId); state.mouse.down=state.mouse.rightDown=state.mouse.dragging=false; }
  canvas.addEventListener('pointerup',endMouse); canvas.addEventListener('pointercancel',endMouse);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.wheel+=Math.sign(e.deltaY);},{passive:false});
  const stick=dom.getElementById('stick'), knob=dom.getElementById('stickKnob');
  let stickPointer=null;
  function moveStick(e) {
    const r=stick.getBoundingClientRect(), max=r.width*.34;
    const dx=e.clientX-r.left-r.width/2, dz=e.clientY-r.top-r.height/2;
    const scale=Math.min(1,max/(Math.hypot(dx,dz)||1));
    state.touchMove.x=dx*scale/max; state.touchMove.z=dz*scale/max;
    knob.style.transform=`translate(${dx*scale}px,${dz*scale}px)`;
  }
  stick.addEventListener('pointerdown',e=>{e.preventDefault();if(stickPointer!==null)return;stickPointer=e.pointerId;capture(stick,e);moveStick(e);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
  function endStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;release(e.pointerId);state.touchMove.x=state.touchMove.z=0;knob.style.transform='translate(0,0)';}
  for(const event of ['pointerup','pointercancel','lostpointercapture']) stick.addEventListener(event,endStick);
  for(const [id,flag] of [['touchAttack','touchAttack'],['touchGather','touchGather']]) {
    const el=dom.getElementById(id); let pointer=null;
    el.addEventListener('pointerdown',e=>{e.preventDefault();if(pointer!==null)return;pointer=e.pointerId;capture(el,e);state[flag]=true;if(flag==='touchAttack')state.touchAttackPressed=true;});
    const end=e=>{if(pointer!==e.pointerId)return;pointer=null;state[flag]=false;release(e.pointerId);};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,end);
  }
  function reset() {
    for(const id of [...captures.keys()])release(id);
    stickPointer=null; knob.style.transform='translate(0,0)';
    state.keys.clear();state.justPressed.clear();state.touchMove.x=state.touchMove.z=0;
    state.touchAttack=state.touchAttackPressed=state.touchGather=false;
    state.mouse.down=state.mouse.justDown=state.mouse.rightDown=state.mouse.dragging=state.mouse.cancel=false;
    state.wheel=state.orbit=0;
  }
  window.addEventListener('blur',reset);dom.addEventListener('visibilitychange',()=>{if(dom.hidden)reset();});
  function endFrame(){state.justPressed.clear();state.mouse.justDown=state.mouse.cancel=state.touchAttackPressed=false;state.wheel=state.orbit=0;}
  function movementVector(){
    let x=state.touchMove.x,z=state.touchMove.z;
    if(state.keys.has('left'))x--;if(state.keys.has('right'))x++;if(state.keys.has('up'))z--;if(state.keys.has('down'))z++;
    const len=Math.hypot(x,z);return len?{x:x/Math.max(1,len),z:z/Math.max(1,len)}:null;
  }
  return {state,reset,endFrame,movementVector,pressed:code=>state.justPressed.has(code)};
}
