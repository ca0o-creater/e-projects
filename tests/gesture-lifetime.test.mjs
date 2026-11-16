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
    preview.toggle.dispatchEvent(new Event('click'));assert.equal(preview.root.hidden,true);
    window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD'}));assert.equal(preview.root.hidden,false);
    window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD',repeat:true}));assert.equal(preview.root.hidden,false);
    preview.dispose();window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyD'}));
    assert.equal(preview.root.hidden,false);assert.equal(stage.children.length,0);
  }finally{f.cleanup();}
});
