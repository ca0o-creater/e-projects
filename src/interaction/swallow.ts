import { actTwoConfig as config } from '../config/act-two.ts';
import type { SemanticInput, StagePoint } from '../input/semantic.ts';

export type SwallowState = 'intro' | 'ready' | 'dragging' | 'armed' | 'returning' | 'swallowing' | 'complete' | 'disposed';
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const distance = (a:StagePoint,b:StagePoint) => Math.hypot(a.x-b.x,a.y-b.y);
const ease = (v:number) => { const t=clamp(v); return t*t*(3-2*t); };

// 只接受三种语义输入；角度投影和停留计时与鼠标、摄像头完全解耦。
export class SwallowController {
  state:SwallowState='intro';
  progress=0;
  holdElapsed=0;
  endingElapsed=0;
  private clock=0;
  private from=0;
  targetDistance=Infinity;
  get targetCenter():StagePoint { return this.pointAt(1); }
  get inTarget():boolean { return this.targetDistance<=config.arm.stableRadius; }
  private retry=false;
  private emitted=false;
  private onComplete:()=>void;
  constructor(onComplete:()=>void) { this.onComplete=onComplete; }

  pointAt(progress:number):StagePoint {
    const a=config.arm, angle=a.startAngle+(a.endAngle-a.startAngle)*clamp(progress);
    return {x:a.center.x+Math.cos(angle)*a.radius,y:a.center.y+Math.sin(angle)*a.radius};
  }
  get point():StagePoint { return this.pointAt(this.progress); }
  get holdProgress():number { return clamp(this.holdElapsed/config.arm.holdSeconds); }
  get message():string {
    switch(this.state) {
      case 'intro': case 'disposed': return '';
      case 'armed': return '已送达，请松手！';
      case 'returning': return this.retry?'请重新尝试：抬至面部，按住停稳后再松开':'已暂停，手臂正在复位';
      case 'swallowing': return '嫦娥吞药，轻身向月';
      case 'complete': return '月宫地点已解锁';
      case 'dragging': return this.inTarget ? '已进入目标圈，正在充能…' : '沿光弧抬臂，将药瓶送到面部';
      default: return this.retry ? '请重新尝试：拖动手腕光圈，抬至面部后停稳' : '拖动手腕光圈抬臂，送至面部后按住停稳';
    }
  }
  prepare():void { if(this.state==='intro') this.state='ready'; }
  canGrab(point:StagePoint):boolean {
    return this.state==='ready' && Number.isFinite(point.x) && Number.isFinite(point.y)
      && distance(point,this.point)<=config.arm.grabRadius;
  }
  readonly input=(event:SemanticInput):void=>{
    if(this.state==='disposed') return;
    if(event.type==='MOVE' && event.motionPoint && (!Number.isFinite(event.motionPoint.x)||!Number.isFinite(event.motionPoint.y))) {
      this.input({type:'RELEASE',cancelled:true});return;
    }
    if('point' in event && (!Number.isFinite(event.point.x) || !Number.isFinite(event.point.y)
      || event.point.x<0 || event.point.x>config.stage.width || event.point.y<0 || event.point.y>config.stage.height)) {
      this.input({type:'RELEASE',cancelled:true});return;
    }
    if(event.type==='GRAB' && this.canGrab(event.point)) {
      this.state='dragging';this.retry=false;this.resetHold(event.point);
    } else if(event.type==='MOVE' && (this.state==='dragging' || this.state==='armed')) {
      const a=config.arm, p=event.point;

      if(distance(p,a.center)<a.centerDeadZone) { this.state='dragging';this.progress=0;this.resetHold(p);return; }
      // 将方向展开到有限弧的邻近角域，避免 atan2 在 ±π 跳变。
      const mid=(a.startAngle+a.endAngle)/2;
      let angle=Math.atan2(p.y-a.center.y,p.x-a.center.x);
      angle=mid+Math.atan2(Math.sin(angle-mid),Math.cos(angle-mid));

      this.progress=clamp((angle-a.startAngle)/(a.endAngle-a.startAngle));
      this.targetDistance=distance(p,this.targetCenter);
      if(!this.inTarget) { this.state='dragging';this.holdElapsed=0; }
    } else if(event.type==='RELEASE' && (this.state==='dragging' || this.state==='armed')) {
      this.from=this.progress;this.clock=0;
      if(this.state==='armed' && this.inTarget && !event.cancelled) {
        this.state='swallowing';this.endingElapsed=0;
      } else { this.state='returning';this.retry=!event.cancelled; }
      this.resetHold(null);
    }
  };
  private resetHold(point:StagePoint|null):void { this.targetDistance=point?distance(point,this.targetCenter):Infinity;this.holdElapsed=0; }
  update(dt:number):void {
    if(!Number.isFinite(dt) || dt<=0 || this.state==='disposed') return;
    if(this.state==='dragging' && this.inTarget) {
      this.holdElapsed+=dt;
      if(this.holdElapsed+1e-9>=config.arm.holdSeconds) this.state='armed';
    } else if(this.state==='returning') {
      this.clock+=dt;this.progress=this.from*(1-ease(this.clock/config.arm.returnSeconds));
      if(this.clock>=config.arm.returnSeconds) this.state='ready';
    } else if(this.state==='swallowing') {
      this.endingElapsed+=dt;
      this.progress=this.from+(1-this.from)*ease(this.endingElapsed/config.ending.swallowSeconds);
      if(this.endingElapsed>=config.ending.swallowSeconds+config.ending.riseSeconds) {
        this.state='complete';
        if(!this.emitted) {this.emitted=true;this.onComplete();}
      }
    }
  }
  dispose():void { this.state='disposed';this.resetHold(null);this.onComplete=()=>{}; }
}
