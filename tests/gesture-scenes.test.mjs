import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PinchController} from '../src/input/pinch-controller.ts';
import {bridgeGestureInput} from '../src/input/gesture-semantics.ts';
import {captureSwallowTarget,captureAscentTarget} from '../src/input/scene-targets.ts';
import {gestureConfig as config} from '../src/config/gesture.config.ts';
import {SwallowController} from '../src/interaction/swallow.ts';
import {AscentController} from '../src/interaction/ascent.ts';
import {ascentDragDistance} from '../src/scenes/ascent-pose.ts';

function hand(p,closed){
  const x=1-(config.roi.x+p.x/1920*config.roi.width),y=config.roi.y+p.y/1080*config.roi.height;
  const a=Array.from({length:21},()=>({x,y})),d=closed?.01:.1;
  a[4]={x:x-d,y};a[8]={x:x+d,y};a[5]={x:x-.1,y};a[17]={x:x+.1,y};return a;
}
function fixture(kind){
  let successes=0,now=0;
  const c=kind==='swallow'?new SwallowController(()=>successes++):new AscentController(()=>successes++);
  const target=()=>kind==='swallow'?captureSwallowTarget(c):captureAscentTarget(c);
  const pinch=new PinchController(bridgeGestureInput(c.input),p=>c.canGrab(p),target);
  const frame=(p,closed=true)=>{now+=20;pinch.update(hand(p,closed),now);c.update(.02);};
  return {c,pinch,successes:()=>successes,
    grab(p=c.point){frame(p,false);for(let i=0;i<5;i++)frame(p);},
    move(p,frames=80){for(let i=0;i<frames;i++)frame(p);},
    release(p){frame(p,false);},
    lose(){now+=500;pinch.missing(now);},
  };
}
test('第二幕入场锁定：捏合不能捕获，解锁后必须重新张开再捏合',()=>{
  const f=fixture('swallow');f.grab();assert.equal(f.c.state,'intro');
  f.c.prepare();f.move(f.c.point,10);assert.equal(f.c.state,'ready');
  f.grab();assert.equal(f.c.state,'dragging');
});
test('第二幕仅Y位移映射弧线；面部保持400ms后张开才吞药且仅成功一次',()=>{
  const f=fixture('swallow');f.c.prepare();const p={...f.c.point};f.grab(p);
  f.move({x:p.x+200,y:p.y});assert.ok(f.c.progress<1e-6);
  const target={x:p.x+150,y:p.y-config.swallow.liftDistance};
  f.move(target);assert.equal(f.c.state,'armed');assert.equal(f.c.message,'已送达，请松手！');
  assert.equal(f.successes(),0);f.release(target);assert.equal(f.c.state,'swallowing');
  f.c.update(5);f.release(target);assert.equal(f.successes(),1);
});
test('第二幕中途松手复位；丢手连同已armed状态取消，不能吞药或显示失败',()=>{
  for(const lost of [false,true]){
    const f=fixture('swallow');f.c.prepare();const p={...f.c.point};f.grab(p);
    const target={x:p.x,y:p.y-config.swallow.liftDistance*(lost?1:.4)};
    f.move(target);if(lost)assert.equal(f.c.state,'armed');
    if(lost)f.lose();else f.release(target);
    assert.equal(f.c.state,'returning');if(lost)assert.doesNotMatch(f.c.message,/重新尝试|失败/);
    f.c.update(2);assert.equal(f.c.state,'ready');assert.equal(f.c.progress,0);assert.equal(f.successes(),0);
  }
});
test('第三幕半途松手与丢手保留高度；重新命中后从当前进度继续，无跳变',()=>{
  const f=fixture('ascent');f.c.prepare();const p={...f.c.point};f.grab(p);
  const mid={x:p.x+180,y:p.y-ascentDragDistance*.4};f.move(mid);f.release(mid);
  const held=f.c.progress;assert.ok(Math.abs(held-.4)<.001);assert.equal(f.c.state,'ready');
  f.c.update(3);assert.equal(f.c.progress,held);
  const again={...f.c.point};f.grab(again);assert.ok(Math.abs(f.c.progress-held)<1e-6);
  f.move({x:again.x-200,y:again.y-ascentDragDistance*.2});f.lose();
  const lost=f.c.progress;assert.ok(Math.abs(lost-.6)<2*config.deadzonePx/ascentDragDistance);assert.equal(f.c.state,'ready');
  f.move(f.c.point,10);assert.equal(f.c.progress,lost); // still pinched after loss cannot resume
  assert.equal(f.successes(),0);
});
test('第三幕95%以上停稳再松手才入月；丢手取消资格而保持高度',()=>{
  for(const lost of [false,true]){
    const f=fixture('ascent');f.c.prepare();const p={...f.c.point};f.grab(p);
    const target={x:p.x,y:p.y-ascentDragDistance*.98};f.move(target);
    assert.equal(f.c.state,'armed');assert.equal(f.c.message,'已送达，请松手！');
    if(lost){f.lose();assert.equal(f.c.state,'ready');assert.ok(f.c.progress>.97);f.c.update(4);assert.equal(f.successes(),0);}
    else {f.release(target);assert.equal(f.c.state,'ending');f.c.update(5);assert.equal(f.successes(),1);}
  }
});

test('目标圆内手部抖动不撤销充能；必须松手才完成',()=>{
  for(const kind of ['swallow','ascent']){
    const f=fixture(kind);f.c.prepare();const p={...f.c.point};f.grab(p);
    const d=kind==='swallow'?config.swallow.liftDistance:ascentDragDistance;
    const target={x:p.x,y:p.y-d};
    for(let i=0;i<80;i++)f.move({x:p.x+Math.sin(i*.3)*30,y:target.y+Math.sin(i*.4)*10},1);
    assert.equal(f.c.state,'armed');assert.equal(f.successes(),0);
    f.release(target);assert.equal(f.c.state,kind==='swallow'?'swallowing':'ending');
  }
});
