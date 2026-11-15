import {test} from 'node:test';import assert from 'node:assert/strict';
import {AscentController} from '../src/interaction/ascent.ts';import {scene3Config as c} from '../src/config/scene3.config.ts';
import {ascentDragDistance,ascentPoseAt} from '../src/scenes/ascent-pose.ts';
import {Container,Texture} from 'pixi.js';
import {createChangeRig} from '../src/characters/change.ts';
import {changeRigConfig as rigConfig} from '../src/config/change-rig.ts';
const travel=ascentDragDistance;
test('飞近放大时真实腰部与抓取点始终重合，拖动距离包含缩放位移',()=>{
 const parent=new Container(),rig=createChangeRig(Texture.EMPTY);parent.addChild(rig.root);
 const s=new AscentController(()=>{});s.prepare();const start=s.point;s.input({type:'GRAB',point:start});
 for(let i=0;i<=100;i++){
  const p=i/100,pose=ascentPoseAt(p);rig.root.position.set(pose.x,pose.y);rig.root.scale.set(pose.scale);
  const waist=rig.root.toGlobal({x:c.character.waist.x-rigConfig.origin.x,y:c.character.waist.y-rigConfig.origin.y});
  assert.ok(Math.hypot(waist.x-pose.point.x,waist.y-pose.point.y)<1e-6);
  s.input({type:'MOVE',point:{x:start.x,y:start.y-travel*p}});
  assert.ok(Math.abs(s.progress-p)<1e-8);assert.ok(Math.abs(s.point.y-(start.y-travel*p))<1e-8);
 }
 assert.equal(ascentPoseAt(0).scale,c.character.startScale);
 assert.ok(Math.abs(ascentPoseAt(1).scale-c.character.endScale)<1e-8);
 parent.destroy({children:true});
});
function setup(){let n=0;const s=new AscentController(()=>n++);s.prepare();return {s,count:()=>n};}
function drag(s,p){const start=s.point;s.input({type:'GRAB',point:start});s.input({type:'MOVE',point:{x:start.x,y:start.y-p*travel}});}
test('入场锁定、只抓主杆，X轴锁定，Y轴限制在范围内',()=>{const s=new AscentController(()=>{});s.input({type:'GRAB',point:s.point});assert.equal(s.state,'intro');s.prepare();s.input({type:'GRAB',point:{x:0,y:0}});assert.equal(s.state,'ready');const x=s.point.x;drag(s,.5);s.input({type:'MOVE',point:{x:1500,y:0}});assert.equal(s.progress,1);assert.equal(s.point.x,x);});
test('半途松手保持进度，再次抓取无跳变并可接续升空',()=>{const {s}=setup();drag(s,.4);s.input({type:'RELEASE'});const before=s.point;s.update(20);assert.equal(s.progress,.4);assert.deepEqual(s.point,before);s.input({type:'GRAB',point:s.point});assert.equal(s.progress,.4);s.input({type:'RELEASE'});drag(s,.2);assert.ok(Math.abs(s.progress-.6)<1e-8);});
test('95%以上按住停稳400ms后松手才收尾；完成事件仅一次',()=>{const {s,count}=setup();drag(s,.96);s.update(.399);assert.equal(s.state,'dragging');s.update(.001);assert.equal(s.state,'armed');s.update(2);assert.equal(count(),0);s.input({type:'RELEASE'});assert.equal(s.state,'ending');s.update(c.ending.duration);assert.equal(s.state,'complete');assert.equal(count(),1);s.input({type:'RELEASE'});s.update(10);assert.equal(count(),1);});
test('未达到阈值或停留不足松手均保持高度而不通关',()=>{for(const [p,t]of [[.94,2],[.96,.399]]){const {s,count}=setup();drag(s,p);s.update(t);s.input({type:'RELEASE'});assert.equal(s.state,'ready');assert.ok(Math.abs(s.progress-p)<1e-8);assert.equal(count(),0);}});
test('移出目标区或持续移动撤销停留资格，取消/越界保持高度',()=>{const {s,count}=setup();drag(s,.97);s.update(.4);const p=s.point;s.input({type:'MOVE',point:{x:p.x+20,y:p.y}});assert.equal(s.state,'dragging');assert.equal(s.hold,0);s.input({type:'RELEASE',cancelled:true});assert.equal(s.state,'ready');const progress=s.progress;drag(s,0);s.input({type:'MOVE',point:{x:NaN,y:0}});assert.equal(s.state,'ready');assert.equal(s.progress,progress);assert.equal(count(),0);});
test('辅助按住逐步升空，松开冻结，可继续按住直至通关',()=>{const {s,count}=setup();assert.equal(s.startAssist(),true);s.update(2);s.cancel();const p=s.progress;s.update(20);assert.equal(s.progress,p);assert.equal(s.state,'ready');s.startAssist();for(let i=0;i<1200;i++)s.update(1/60);assert.equal(s.state,'complete');assert.equal(count(),1);assert.equal(s.startAssist(),false);});
test('手动抓取与辅助互斥；销毁停止升空并拒绝所有新输入',()=>{const {s,count}=setup();drag(s,.2);assert.equal(s.startAssist(),false);s.cancel();s.startAssist();s.input({type:'GRAB',point:s.point});assert.equal(s.state,'ready');s.dispose();s.update(100);assert.equal(s.state,'disposed');assert.equal(s.assisting,false);assert.equal(count(),0);});
