import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SwallowController} from '../src/interaction/swallow.ts';
import {actTwoConfig as c} from '../src/config/act-two.ts';
import {PointerInputAdapter} from '../src/input/pointer-adapter.ts';

function setup() {
  let count=0;const s=new SwallowController(()=>count++);s.prepare();
  return {s,count:()=>count};
}
function grab(s) {s.input({type:'GRAB',point:s.point});}
function move(s,p) {s.input({type:'MOVE',point:s.pointAt(p)});}

test('第二幕入场不可操作，仅手腕控制点可抓取',()=>{
  const s=new SwallowController(()=>{});grab(s);assert.equal(s.state,'intro');
  s.prepare();s.input({type:'GRAB',point:{x:100,y:100}});assert.equal(s.state,'ready');
  grab(s);assert.equal(s.state,'dragging');
});
test('方向映射约束于固定圆弧，半途松手平滑返回，之后可重试',()=>{
  const {s}=setup();grab(s);move(s,.5);
  assert.ok(Math.abs(s.progress-.5)<1e-8);
  assert.ok(Math.abs(Math.hypot(s.point.x-c.arm.center.x,s.point.y-c.arm.center.y)-c.arm.radius)<1e-8);
  s.input({type:'RELEASE'});s.update(c.arm.returnSeconds/2);
  assert.ok(s.progress>0 && s.progress<.5);
  s.update(c.arm.returnSeconds/2);assert.equal(s.progress,0);assert.equal(s.state,'ready');
});
test('面部目标区必须按住停稳满400ms，提示后松手才成功，月宫事件仅一次',()=>{
  const {s,count}=setup();grab(s);move(s,1);s.update(.399);
  assert.equal(s.state,'dragging');assert.equal(count(),0);
  s.update(.001);assert.equal(s.state,'armed');assert.equal(s.message,'可以松开');
  s.update(2);assert.equal(count(),0); // 一直按住不能自动吞药
  s.input({type:'RELEASE'});assert.equal(s.state,'swallowing');
  s.update(c.ending.swallowSeconds+c.ending.riseSeconds);
  assert.equal(s.state,'complete');assert.equal(count(),1);
  s.input({type:'RELEASE'});s.update(20);assert.equal(count(),1);
});
test('目标区不足400ms松手、目标区外停留均失败',()=>{
  for(const [progress,time] of [[1,.399],[.89,4]]) {
    const {s,count}=setup();grab(s);move(s,progress);s.update(time);s.input({type:'RELEASE'});
    assert.equal(s.state,'returning');s.update(10);assert.equal(count(),0);
  }
});
test('目标区内持续移动重置计时；小幅抖动允许，累计漂移超容差重新计时',()=>{
  const {s}=setup();grab(s);move(s,1);s.update(.3);
  const p=s.point;
  s.input({type:'MOVE',point:{x:p.x+3,y:p.y}});s.update(.05);
  assert.ok(s.holdElapsed>.3);
  s.input({type:'MOVE',point:{x:p.x,y:p.y-12}});
  assert.equal(s.holdElapsed,0);s.update(.399);assert.equal(s.state,'dragging');
  s.update(.001);assert.equal(s.state,'armed');
});
test('提示可松开后离开目标区会撤销资格，重新进入需再次停留',()=>{
  const {s}=setup();grab(s);move(s,1);s.update(.4);move(s,.5);
  assert.equal(s.state,'dragging');assert.equal(s.holdElapsed,0);
  move(s,1);s.update(.2);s.input({type:'RELEASE'});assert.equal(s.state,'returning');
});
test('取消、越界、无效坐标不能触发吞药；销毁后输入与更新无效',()=>{
  for(const event of [{type:'RELEASE',cancelled:true},{type:'MOVE',point:{x:-1,y:500}},
    {type:'MOVE',point:{x:NaN,y:5}}]) {
    const {s,count}=setup();grab(s);move(s,1);s.update(.4);s.input(event);
    assert.equal(s.state,'returning');s.update(10);assert.equal(count(),0);
    s.dispose();grab(s);s.update(10);assert.equal(s.state,'disposed');
  }
});
test('复用PointerInputAdapter，最终pointerup位置离开目标区不能沿用旧的停留资格',()=>{
  globalThis.window=new EventTarget();
  const {s,count}=setup();
  class Canvas extends EventTarget {
    style={};captured=false;
    getBoundingClientRect(){return {left:0,top:0,width:1920,height:1080};}
    setPointerCapture(){this.captured=true;} hasPointerCapture(){return this.captured;}
    releasePointerCapture(){this.captured=false;}
  }
  const canvas=new Canvas(),adapter=new PointerInputAdapter(canvas,s.input,p=>s.canGrab(p));
  const send=(type,p)=>canvas.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),
    {button:0,isPrimary:true,pointerId:1,clientX:p.x,clientY:p.y}));
  send('pointerdown',s.point);send('pointermove',s.pointAt(1));s.update(.4);
  assert.equal(s.state,'armed');
  send('pointerup',s.pointAt(0));assert.equal(s.state,'returning');s.update(10);assert.equal(count(),0);
  adapter.dispose();delete globalThis.window;
});
