import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PinchController } from '../src/input/pinch-controller.ts';
import { bridgeGestureInput } from '../src/input/gesture-semantics.ts';
import { OneEuroFilter } from '../src/input/one-euro.ts';
import { gestureConfig as config } from '../src/config/gesture.config.ts';
import { HandoffController } from '../src/interaction/handoff.ts';
import { handoffConfig } from '../src/config/handoff.ts';
import { receivingHand } from '../src/characters/poses.ts';
import { mapHandToStage } from '../src/input/gesture-mapping.ts';
import { captureHandoffTarget } from '../src/input/handoff-target.ts';

// Camera-normalized landmarks, mirror matches the visible preview.
function hand(point={x:960,y:540}, ratio=0.1) {
  const x=1-(config.roi.x+point.x/1920*config.roi.width),y=config.roi.y+point.y/1080*config.roi.height;
  const points=Array.from({length:21},()=>({x,y}));
  points[5]={x:x-0.1,y}; points[17]={x:x+0.1,y};
  points[4]={x:x-ratio*0.1,y}; points[8]={x:x+ratio*0.1,y};
  return points;
}
function fixture(canGrab=()=>true) {
  const events=[]; const p=new PinchController(e=>events.push(e),canGrab);
  return {p,events};
}
function grab(p,point={x:960,y:540},time=0) {
  p.update(hand(point,1.0),time);
  p.update(hand(point),time+10);
  p.update(hand(point),time+80);
}

test('two-tip distance immediately grabs; hysteresis starts and ends once without palm or dwell',()=>{
  const {p,events}=fixture();
  p.update(hand(),0);p.update(hand(),100);
  assert.equal(events.filter(e=>e.type==='GRAB_START').length,1);
  for(let t=210;t<400;t+=20)p.update(hand(undefined,0.34),t);
  p.update(hand(undefined,1.0),400);p.update(hand(undefined,1.0),420);
  assert.equal(events.filter(e=>e.type==='GRAB_START').length,1);
  assert.equal(events.filter(e=>e.type==='GRAB_END').length,1);
  assert.equal(events.at(-1).cancelled,undefined);
});
test('pinching outside bottle cannot turn into a grab by moving over it',()=>{
  let allowed=false;const {p,events}=fixture(()=>allowed);grab(p);allowed=true;
  p.update(hand(),100);p.update(hand(),200);
  assert.equal(events.length,0);
  grab(p,undefined,250);assert.equal(events[0].type,'GRAB_START');
});
test('mirror and ROI stage mapping; outside ROI holds capture, invalid hand times out safely',()=>{
  const {p,events}=fixture();const point={x:1500,y:300};
  const cursor=p.update(hand(point,1.0),0,4/3);
  assert.ok(Math.abs(cursor.point.x-point.x)<0.001);assert.ok(Math.abs(cursor.point.y-300)<0.001);
  grab(p,point,20);p.update(hand({x:-10,y:300}),110);
  assert.equal(events.some(e=>e.type==='GRAB_END'),false);
  assert.equal(p.update([{x:NaN,y:0}],120),null);
  p.update(undefined,610);assert.deepEqual(events.at(-1),{type:'GRAB_END',cancelled:true});
});
test('500ms loss sends one cancellation; reacquiring pinched cannot re-grab',()=>{
  const {p,events}=fixture();grab(p);
  p.update(undefined,579);assert.equal(events.some(e=>e.type==='GRAB_END'),false);
  p.update(undefined,580);p.update(undefined,900);
  assert.equal(events.filter(e=>e.type==='GRAB_END').length,1);
  assert.equal(events.at(-1).cancelled,true);
  p.update(hand(),920);p.update(hand(),1000);
  assert.equal(events.filter(e=>e.type==='GRAB_START').length,1);
  grab(p,undefined,1100);assert.equal(events.filter(e=>e.type==='GRAB_START').length,2);
});
test('valid frame after a frozen camera also cancels instead of resuming stale grab',()=>{
  const {p,events}=fixture();grab(p);p.update(hand(),1000);
  assert.deepEqual(events.at(-1),{type:'GRAB_END',cancelled:true});
});
test('One Euro attenuates stationary jitter and follows sustained motion, reset removes lag',()=>{
  const f=new OneEuroFilter(config.filter);assert.equal(f.update(100,0),100);
  assert.ok(f.update(110,16)>100 && f.update(110,16)<110);
  let v=0;for(let t=32;t<1000;t+=16)v=f.update(500,t);
  assert.ok(v>495 && v<=500);assert.ok(Number.isFinite(f.update(500,990)));
  f.reset();assert.equal(f.update(50,1000),50);
});
test('landmarks -> semantic bridge -> existing bottle controller completes once',()=>{
  let successes=0;
  const c=new HandoffController(receivingHand,()=>successes++);
  const start={x:1380,y:285};c.prepare();c.setPath(start);c.update(handoffConfig.offering.duration);
  const p=new PinchController(bridgeGestureInput(c.input),point=>c.canGrab(point),()=>captureHandoffTarget(c.point,receivingHand(1)));grab(p,start);
  assert.equal(c.state,'dragging');
  const end=receivingHand(1);
  for(let t=100;t<1500;t+=20)p.update(hand(end),t);
  assert.equal(c.state,'snapped');
  p.update(hand(end,1.0),1500);assert.equal(c.state,'completing');c.update(5);
  p.cancel();c.update(5);assert.equal(c.state,'complete');assert.equal(successes,1);
});
test('loss after bottle snap cancels success and returns to safe ready pose',()=>{
  const c=new HandoffController(receivingHand,()=>assert.fail('must not succeed'));
  const start={x:1380,y:285};c.prepare();c.setPath(start);c.update(handoffConfig.offering.duration);
  const p=new PinchController(bridgeGestureInput(c.input),point=>c.canGrab(point),()=>captureHandoffTarget(c.point,receivingHand(1)));grab(p,start);
  for(let t=100;t<1500;t+=20)p.update(hand(receivingHand(1)),t);
  assert.equal(c.state,'snapped');p.missing(2000);assert.equal(c.state,'returning');
  c.update(5);assert.equal(c.state,'ready');assert.equal(c.progress,0);
});

test('central 60% maps full stage, X is mirrored, ROI edges are inclusive',()=>{
  for(const [camera,expected] of [[{x:.8,y:.2},{x:0,y:0}],[{x:.2,y:.8},{x:1920,y:1080}],[{x:.5,y:.5},{x:960,y:540}]]){
    const mapped=mapHandToStage(camera);assert.equal(mapped.inside,true);
    assert.ok(Math.abs(mapped.point.x-expected.x)<1e-6);assert.ok(Math.abs(mapped.point.y-expected.y)<1e-6);
  }
  assert.ok(mapHandToStage({x:.45,y:.5}).point.x>mapHandToStage({x:.5,y:.5}).point.x);
  assert.equal(mapHandToStage({x:.9,y:.5}).inside,false);
});
test('grab captures bottle offset, first frame never jumps; only hand displacement moves target',()=>{
  const events=[];const target={x:1000,y:550};
  const p=new PinchController(e=>events.push(e),()=>true,()=>({point:target,constrain:p=>p}));
  const origin={x:960,y:540};grab(p,origin);
  assert.deepEqual(events[0],{type:'GRAB_START',point:{x:1000,y:550}});
  assert.deepEqual(events.at(-1).delta,{x:0,y:0});
  target.x=1400; // Captured snapshot must not follow the later floating idle target.
  for(let t=100;t<1600;t+=20)p.update(hand({x:1060,y:590}),t);
  assert.ok(Math.abs(events.at(-1).delta.x-100)<config.deadzonePx);
  assert.ok(Math.abs(events.at(-1).delta.y-50)<config.deadzonePx);
  p.cancel();const before=events.length;p.update(hand({x:1800,y:100}),1700);
  assert.equal(events.length,before); // Still pinched cannot reacquire after cancel.
});
test('outside ROI cannot start a grab, but captured overtravel clamps at path endpoint',()=>{
  const events=[];const start={x:1380,y:285},end=receivingHand(1);
  const target=captureHandoffTarget(start,end);
  const p=new PinchController(e=>events.push(e),()=>true,()=>target);
  grab(p,{x:2000,y:285});assert.equal(events.length,0);
  grab(p,start,120);
  for(let t=220;t<1600;t+=20)p.update(hand({x:-300,y:900}),t);
  assert.equal(events.some(e=>e.type==='GRAB_END'),false);
  assert.deepEqual(events.at(-1).delta,{x:end.x-start.x,y:end.y-start.y});
  assert.deepEqual(target.constrain({x:-10000,y:10000}),end);
  assert.deepEqual(target.constrain({x:10000,y:-10000}),start);
});

test('aspect-correct distance uses only 4 and 8, with exact strict hysteresis thresholds',()=>{
  const {p,events}=fixture();
  const sample=(distance)=>{const a=[];a[4]={x:.5,y:.5};a[8]={x:.5+distance/(16/9),y:.5};return a;};
  let c=p.update(sample(.099),0,16/9);assert.equal(events[0].type,'GRAB_START');
  assert.ok(Math.abs(c.diagnostics.distance-.099)<1e-9);
  for(const [t,d] of [[20,.101],[40,.149],[60,.12]])p.update(sample(d),t,16/9);
  assert.equal(events.filter(e=>e.type==='GRAB_END').length,0);
  p.update(sample(.151),80,16/9);assert.equal(events.at(-1).type,'GRAB_END');
  const count=events.filter(e=>e.type==='GRAB_START').length;p.update(sample(.12),100,16/9);
  assert.equal(events.filter(e=>e.type==='GRAB_START').length,count);
});
test('2px deadzone suppresses static jitter but slow intentional motion accumulates',()=>{
  const {p,events}=fixture();const base={x:960,y:540};
  p.update(hand(base),0);const count=events.length;
  for(let t=20;t<1000;t+=20){
    const c=p.update(hand({x:960+Math.sin(t)*.8,y:540+Math.cos(t)*.8}),t);
    assert.deepEqual(c.point,base);
    assert.ok(Number.isFinite(c.diagnostics.filtered.x));
  }
  assert.equal(events.length,count);
  for(let i=0;i<120;i++)p.update(hand({x:960+i*.2,y:540}),1000+i*20);
  assert.ok(events.at(-1).delta.x>15);assert.equal('point' in events.at(-1),false);
});
test('opening fingers never sends a final pose-change displacement; late delta after end is ignored',()=>{
  const {p,events}=fixture();p.update(hand(),0);const n=events.length;
  p.update(hand({x:1200,y:540},1.0),20);
  assert.equal(events.length,n+1);assert.equal(events.at(-1).type,'GRAB_END');
  const out=[],send=bridgeGestureInput(e=>out.push(e));
  send({type:'CONTROL_UPDATE',delta:{x:5,y:6}});assert.equal(out.length,0);
  send({type:'GRAB_START',point:{x:10,y:20}});send({type:'CONTROL_UPDATE',delta:{x:5,y:-6}});
  assert.deepEqual(out.at(-1),{type:'MOVE',point:{x:15,y:14}});
  send({type:'GRAB_END'});send({type:'CONTROL_UPDATE',delta:{x:999,y:999}});
  assert.equal(out.at(-1).type,'RELEASE');
});
