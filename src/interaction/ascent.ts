import {scene3Config as c} from '../config/scene3.config.ts';
import {ascentPoseAt,ascentDragDistance} from '../scenes/ascent-pose.ts';
import type {SemanticInput,StagePoint} from '../input/semantic.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export type AscentState = 'intro'|'ready'|'dragging'|'armed'|'ending'|'complete'|'disposed';
export interface AscentSnapshot {
 readonly state: AscentState;
 readonly inTarget: boolean;
 readonly assisting: boolean;
 readonly charging: boolean;
}
export type AscentChangeReason = 'interaction' | 'cancel' | 'update' | 'dispose';
export class AscentController {
 state:AscentState='intro';
 progress=0;hold=0;ending=0;assisting=false;
 private grabY=0;private from=0;targetDistance=Infinity;private emitted=false;
 private onComplete:()=>void;
 constructor(onComplete:()=>void){this.onComplete=onComplete;}
 private listeners=new Set<(next:AscentSnapshot,previous:AscentSnapshot,reason:AscentChangeReason)=>void>();
 private lastSnapshot:AscentSnapshot={state:'intro',inTarget:false,assisting:false,charging:false};
 get snapshot():AscentSnapshot {
  return {state:this.state,inTarget:this.inTarget,assisting:this.assisting,
   charging:((this.state==='dragging'||this.state==='armed')&&this.inTarget)
    ||(this.state==='ready'&&this.assisting&&this.progress===1)};
 }
 subscribeState(listener:(next:AscentSnapshot,previous:AscentSnapshot,reason:AscentChangeReason)=>void):()=>void {
  if(this.state==='disposed')return ()=>{};
  this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};
 }
 private notify(reason:AscentChangeReason):void {
  const next=this.snapshot,previous=this.lastSnapshot;
  if(next.state===previous.state&&next.inTarget===previous.inTarget&&next.assisting===previous.assisting&&next.charging===previous.charging)return;
  this.lastSnapshot=next;
  for(const listener of this.listeners)listener(next,previous,reason);
 }
 get point():StagePoint {return ascentPoseAt(this.progress).point;}
 get targetCenter():StagePoint{return ascentPoseAt(1).point;}
 get inTarget():boolean{return this.targetDistance<=c.control.stableRadius;}
 get message():string {switch(this.state){case'intro':return '';case'armed':return '已送达，请松手！';case'ending':return '飞入月宫…';case'complete':return '清冷月宫，相思无尽';case'disposed':return '';default:return this.assisting?'正在辅助升空，请保持按住':this.inTarget?'已进入目标圈，正在充能…':'向上拖动腰部主杆光圈，松手可停留';}}
 prepare():void{if(this.state==='intro'){this.state='ready';this.notify('update');}}
 canGrab(p:StagePoint):boolean{return this.state==='ready'&&!this.assisting&&Math.hypot(p.x-this.point.x,p.y-this.point.y)<=c.control.grabRadius;}
 readonly input=(e:SemanticInput):void=>{
 try{this.handleInput(e);}finally{this.notify('interaction');}
 };
 private handleInput(e:SemanticInput):void {
 if(this.assisting||this.state==='disposed')return;
 if(e.type==='MOVE'&&e.motionPoint&&(!Number.isFinite(e.motionPoint.x)||!Number.isFinite(e.motionPoint.y))){this.cancel();return;}
 if('point'in e&&(!Number.isFinite(e.point.x)||!Number.isFinite(e.point.y)||e.point.x<0||e.point.x>c.stage.width||e.point.y<0||e.point.y>c.stage.height)){this.cancel();return;}
 if(e.type==='GRAB'&&this.canGrab(e.point)){this.state='dragging';this.grabY=e.point.y;this.from=this.progress;this.targetDistance=Math.hypot(e.point.x-this.targetCenter.x,e.point.y-this.targetCenter.y);this.hold=0;}
 else if(e.type==='MOVE'&&(this.state==='dragging'||this.state==='armed')){


 this.progress=clamp(this.from+(this.grabY-e.point.y)/ascentDragDistance);
 this.targetDistance=Math.hypot(e.point.x-this.targetCenter.x,e.point.y-this.targetCenter.y);
 if(!this.inTarget){this.hold=0;this.state='dragging';}
 }else if(e.type==='RELEASE'&&(this.state==='dragging'||this.state==='armed')){
 if(this.state==='armed'&&this.inTarget&&!e.cancelled)this.finish();else this.cancel(e.cancelled??false);
 }}
 startAssist():boolean{if(this.state!=='ready'||this.assisting)return false;this.assisting=true;this.hold=0;this.notify('interaction');return true;}
 // 默认是系统取消；正常松开辅助按钮必须显式传 false。
 cancel(cancelled=true):void{this.assisting=false;this.hold=0;this.targetDistance=Infinity;if(this.state==='dragging'||this.state==='armed')this.state='ready';this.notify(cancelled?'cancel':'interaction');}
 private finish():void{this.assisting=false;this.state='ending';this.ending=0;this.hold=0;this.notify('interaction');}
 update(dt:number):void{
 try{this.advance(dt);}finally{this.notify('update');}
 }
 private advance(dt:number):void{
 if(!Number.isFinite(dt)||dt<=0)return;
 if(this.assisting&&this.state==='ready'){
 const timeToTop=(1-this.progress)/c.control.assistSpeed;
 this.progress=clamp(this.progress+c.control.assistSpeed*dt);
 // 抵达最高点之前的时间不能计入停稳，确保充能完整持续0.4秒。
 if(this.progress===1){this.notify('update');this.hold+=Math.max(0,dt-timeToTop);if(this.hold+1e-9>=c.control.holdSeconds)this.finish();}
 }else if(this.state==='dragging'&&this.inTarget){this.hold+=dt;if(this.hold+1e-9>=c.control.holdSeconds)this.state='armed';}
 else if(this.state==='ending'){this.ending=clamp(this.ending+dt/c.ending.duration);if(this.ending===1){this.state='complete';this.notify('update');if(!this.emitted){this.emitted=true;this.onComplete();}}}
 }
 dispose():void{if(this.state==='disposed')return;this.assisting=false;this.hold=0;this.targetDistance=Infinity;this.state='disposed';this.onComplete=()=>{};this.notify('dispose');this.listeners.clear();}
}
