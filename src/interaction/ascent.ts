import {scene3Config as c} from '../config/scene3.config.ts';
import {ascentPoseAt,ascentDragDistance} from '../scenes/ascent-pose.ts';
import type {SemanticInput,StagePoint} from '../input/semantic.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export class AscentController {
 state:'intro'|'ready'|'dragging'|'armed'|'ending'|'complete'|'disposed'='intro';
 progress=0;hold=0;ending=0;assisting=false;
 private grabY=0;private from=0;targetDistance=Infinity;private emitted=false;
 private onComplete:()=>void;
 constructor(onComplete:()=>void){this.onComplete=onComplete;}
 get point():StagePoint {return ascentPoseAt(this.progress).point;}
 get targetCenter():StagePoint{return ascentPoseAt(1).point;}
 get inTarget():boolean{return this.targetDistance<=c.control.stableRadius;}
 get message():string {switch(this.state){case'intro':return '';case'armed':return '已送达，请松手！';case'ending':return '飞入月宫…';case'complete':return '清冷月宫，相思无尽';case'disposed':return '';default:return this.assisting?'正在辅助升空，请保持按住':this.inTarget?'已进入目标圈，正在充能…':'向上拖动腰部主杆光圈，松手可停留';}}
 prepare():void{if(this.state==='intro')this.state='ready';}
 canGrab(p:StagePoint):boolean{return this.state==='ready'&&!this.assisting&&Math.hypot(p.x-this.point.x,p.y-this.point.y)<=c.control.grabRadius;}
 readonly input=(e:SemanticInput):void=>{
 if(this.assisting||this.state==='disposed')return;
 if(e.type==='MOVE'&&e.motionPoint&&(!Number.isFinite(e.motionPoint.x)||!Number.isFinite(e.motionPoint.y))){this.cancel();return;}
 if('point'in e&&(!Number.isFinite(e.point.x)||!Number.isFinite(e.point.y)||e.point.x<0||e.point.x>c.stage.width||e.point.y<0||e.point.y>c.stage.height)){this.cancel();return;}
 if(e.type==='GRAB'&&this.canGrab(e.point)){this.state='dragging';this.grabY=e.point.y;this.from=this.progress;this.targetDistance=Math.hypot(e.point.x-this.targetCenter.x,e.point.y-this.targetCenter.y);this.hold=0;}
 else if(e.type==='MOVE'&&(this.state==='dragging'||this.state==='armed')){


 this.progress=clamp(this.from+(this.grabY-e.point.y)/ascentDragDistance);
 this.targetDistance=Math.hypot(e.point.x-this.targetCenter.x,e.point.y-this.targetCenter.y);
 if(!this.inTarget){this.hold=0;this.state='dragging';}
 }else if(e.type==='RELEASE'&&(this.state==='dragging'||this.state==='armed')){
 if(this.state==='armed'&&this.inTarget&&!e.cancelled)this.finish();else this.cancel();
 }};
 startAssist():boolean{if(this.state!=='ready')return false;this.assisting=true;this.hold=0;return true;}
 cancel():void{this.assisting=false;this.hold=0;this.targetDistance=Infinity;if(this.state==='dragging'||this.state==='armed')this.state='ready';}
 private finish():void{this.assisting=false;this.state='ending';this.ending=0;this.hold=0;}
 update(dt:number):void{
 if(!Number.isFinite(dt)||dt<=0)return;
 if(this.assisting&&this.state==='ready'){
 this.progress=clamp(this.progress+c.control.assistSpeed*dt);
 if(this.progress===1){this.hold+=dt;if(this.hold+1e-9>=c.control.holdSeconds)this.finish();}
 }else if(this.state==='dragging'&&this.inTarget){this.hold+=dt;if(this.hold+1e-9>=c.control.holdSeconds)this.state='armed';}
 else if(this.state==='ending'){this.ending=clamp(this.ending+dt/c.ending.duration);if(this.ending===1){this.state='complete';if(!this.emitted){this.emitted=true;this.onComplete();}}}
 }
 dispose():void{this.cancel();this.state='disposed';this.onComplete=()=>{};}
}
