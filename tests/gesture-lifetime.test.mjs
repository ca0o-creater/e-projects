import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActOneInput } from '../src/input/act-one-input.ts';
import { GesturePreview } from '../src/input/gesture-preview.ts';

class Element extends EventTarget {
  children=[];style={};dataset={};hidden=false;value='';textContent='';srcObject=null;captures=new Set();
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  setAttribute(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  pause(){}
  play(){return Promise.resolve();}
  getBoundingClientRect(){return {left:0,top:0,width:1920,height:1080};}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(mediaDevices){
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices}});
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  document.createElement=()=>new Element();globalThis.cancelAnimationFrame=()=>{};
  const stage=new Element(),canvas=new Element(),events=[];
  const input=new ActOneInput(stage,canvas,e=>events.push(e),()=>true);
  const panel=stage.children[0],select=panel.children[0].children[0],status=panel.children[1];
  return {stage,canvas,events,input,panel,status,select,
    choose(value){select.value=value;select.dispatchEvent(new Event('change'));},
    cleanup(){input.dispose();delete globalThis.window;delete globalThis.document;delete globalThis.cancelAnimationFrame;
      if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}};
}
function down(canvas){canvas.dispatchEvent(Object.assign(new Event('pointerdown'),{pointerId:1,isPrimary:true,button:0,clientX:960,clientY:540}));}
function landmarks(closed){
  const a=Array.from({length:21},()=>({x:.5,y:.5}));const d=closed?.01:.1;
  a[4]={x:.5-d,y:.5};a[8]={x:.5+d,y:.5};a[5]={x:.4,y:.5};a[17]={x:.6,y:.5};return a;
}
function pinchFrames(p,start=0){p.update(landmarks(false),start);p.update(landmarks(true),start+20);p.update(landmarks(true),start+100);}

test('denied camera cancels mouse grab, restores exactly one mouse source',async()=>{
  const f=fixture({getUserMedia:async()=>{throw new DOMException('denied','NotAllowedError');}});
  try{
    down(f.canvas);f.choose('gesture');await flush();
    assert.deepEqual(f.events.at(-1),{type:'RELEASE',cancelled:true});
    assert.equal(f.select.value,'pointer');assert.match(f.status.textContent,/未获摄像头权限/);
    const count=f.events.length;down(f.canvas);assert.equal(f.events.length,count+1);
    assert.equal(f.events.at(-1).type,'GRAB');
  }finally{f.cleanup();}
});
test('late camera permission after switching back stops tracks and cannot revive camera',async()=>{
  let resolve;let stopped=0;const f=fixture({getUserMedia:()=>new Promise(r=>resolve=r)});
  try{
    f.choose('gesture');f.choose('pointer');
    resolve({getTracks:()=>[{stop:()=>stopped++}]});await flush();
    assert.equal(stopped,1);assert.equal(f.panel.dataset.mode,'pointer');
    down(f.canvas);assert.equal(f.events.filter(e=>e.type==='GRAB').length,1);
  }finally{f.cleanup();}
});
test('scene disposal while permission is pending leaves no UI, streams or pointer handlers',async()=>{
  let resolve;let stopped=0;const f=fixture({getUserMedia:()=>new Promise(r=>resolve=r)});
  try{
    f.choose('gesture');f.input.dispose();
    resolve({getTracks:()=>[{stop:()=>stopped++}]});await flush();
    down(f.canvas);assert.equal(f.events.length,0);assert.equal(stopped,1);assert.equal(f.stage.children.length,0);
  }finally{f.cleanup();}
});
test('unsupported camera falls back without changing story',async()=>{
  const f=fixture(undefined);
  try{f.choose('gesture');await flush();assert.equal(f.select.value,'pointer');assert.match(f.status.textContent,/摄像头不可用/);assert.equal(f.events.length,0);}
  finally{f.cleanup();}
});

test('preview button and D toggle only the debug panel; disposal removes keyboard listener',()=>{
  const f=fixture(undefined);
  try {
    const panel=new Element(),stage=new Element(),preview=new GesturePreview(stage,panel);
    preview.setEnabled(true);assert.equal(preview.root.hidden,false);
    preview.updateMetrics({distance:.0345,pinched:true,grabbing:true,neutralRequired:false,
      raw:{x:100,y:200},filtered:{x:99,y:199},stable:{x:98,y:198}});
    assert.match(preview.metrics.textContent,/0.0345/);assert.match(preview.metrics.textContent,/抓取：是/);
    assert.match(preview.metrics.textContent,/滤波后：99.0, 199.0/);assert.equal(preview.metrics.hidden,false);
    preview.toggle.dispatchEvent(new Event('click'));assert.equal(preview.root.hidden,true);
    assert.equal(preview.metrics.hidden,true);
    window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD'}));assert.equal(preview.root.hidden,false);
    window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD',repeat:true}));assert.equal(preview.root.hidden,false);
    preview.dispose();window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD'}));
    assert.equal(preview.root.hidden,false);assert.equal(stage.children.length,0);
  }finally{f.cleanup();}
});

test('跨幕只重绑目标、释放旧捕获并清平滑缓存；摄像头请求仅一次，捏合不能跨幕沿用',()=>{
  let requests=0;const f=fixture({getUserMedia:()=>{requests++;return new Promise(()=>{});}});
  try {
    const old=[],next=[],capture=()=>({point:{x:960,y:540},constrain:p=>p});
    f.input.bind(e=>old.push(e),()=>true,capture);f.choose('gesture');
    const source=f.input.source;pinchFrames(source.pinch);
    assert.equal(old[0].type,'GRAB');
    f.input.bind(e=>next.push(e),()=>true,capture);
    assert.deepEqual(old.at(-1),{type:'RELEASE',cancelled:true});
    const oldCount=old.length;source.pinch.update(landmarks(true),120);assert.equal(next.length,0);
    pinchFrames(source.pinch,150);assert.equal(next[0].type,'GRAB');assert.equal(old.length,oldCount);
    assert.equal(f.input.source,source);assert.equal(requests,1);assert.equal(f.select.value,'gesture');
    f.input.unbind();const count=next.length;pinchFrames(source.pinch,300);assert.equal(next.length,count);
  }finally{f.cleanup();}
});
test('UI pointerdown先取消手势；按钮按住期间不许重抓；释放后需先张开才能接管',()=>{
  const f=fixture({getUserMedia:()=>new Promise(()=>{})});
  try {
    f.input.bind(e=>f.events.push(e),()=>true,()=>({point:{x:960,y:540},constrain:p=>p}));
    f.choose('gesture');const p=f.input.source.pinch;pinchFrames(p);
    const button={closest:selector=>selector==='[data-debug-visibility]'?null:({})};const down=new Event('pointerdown');
    Object.defineProperties(down,{target:{value:button},pointerId:{value:7}});window.dispatchEvent(down);
    assert.deepEqual(f.events.at(-1),{type:'RELEASE',cancelled:true});
    const count=f.events.length;pinchFrames(p,150);assert.equal(f.events.length,count);
    window.dispatchEvent(Object.assign(new Event('pointerup'),{pointerId:7}));p.update(landmarks(true),280);
    assert.equal(f.events.length,count);pinchFrames(p,300);assert.equal(f.events[count].type,'GRAB');
  }finally{f.cleanup();}
});
