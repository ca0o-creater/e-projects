import { gestureConfig as config } from '../config/gesture.config.ts';
import { OneEuroFilter } from './one-euro.ts';
import type { GestureInput } from './gesture-semantics.ts';
import type { StagePoint } from './semantic.ts';
import { clampStage, mapHandToStage, relativeTarget, type CaptureGestureTarget, type GestureTarget } from './gesture-mapping.ts';

export interface Landmark { x: number; y: number }
export interface GestureDiagnostics {
  distance:number; pinched:boolean; grabbing:boolean; neutralRequired:boolean;
  raw:StagePoint; filtered:StagePoint; stable:StagePoint;
  target?:{distance:number;radius:number;progress:number};
}
export interface HandCursor { point:StagePoint; grabbing:boolean; available:boolean; insideRoi:boolean; diagnostics:GestureDiagnostics }

/** Only landmarks 4/8 determine pinch. Filter tips before ROI amplification. */
export class PinchController {
  private readonly send:(event:GestureInput)=>void;
  private readonly canGrab:(point:StagePoint)=>boolean;
  private readonly filters=Array.from({length:4},()=>new OneEuroFilter(config.filter));
  private lastSeen:number|null=null;
  private neutralRequired=false;
  private closed=false;
  private grabbing=false;
  private stable:StagePoint|null=null;
  private lastOutput:StagePoint|null=null;
  private readonly captureTarget?:CaptureGestureTarget;
  private capture:{hand:StagePoint;target:GestureTarget}|null=null;
  constructor(send:(event:GestureInput)=>void,canGrab:(point:StagePoint)=>boolean,captureTarget?:CaptureGestureTarget){
    this.send=send;this.canGrab=canGrab;this.captureTarget=captureTarget;
  }
  cancel():void{
    const wasGrabbing=this.grabbing;
    this.grabbing=this.closed=false;this.neutralRequired=true;
    this.lastSeen=null;this.stable=this.lastOutput=null;this.capture=null;
    this.filters.forEach(f=>f.reset());
    if(wasGrabbing)this.send({type:'GRAB_END',cancelled:true});
  }
  missing(now:number):void{if(this.lastSeen!==null&&now-this.lastSeen>=config.lostHandMs)this.cancel();}
  update(landmarks:readonly Landmark[]|undefined,now:number,aspect=1):HandCursor|null{
    const a=landmarks?.[4],b=landmarks?.[8];
    if(!a||!b||![a,b].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)
      ||!Number.isFinite(aspect)||aspect<=0){this.missing(now);return null;}
    if(this.lastSeen!==null&&now-this.lastSeen>=config.lostHandMs)this.cancel();
    this.lastSeen=now;
    // Euclidean distance in video-height units, independent of aspect ratio.
    const distance=Math.hypot((a.x-b.x)*aspect,a.y-b.y);
    const w=config.stage.width,h=config.stage.height;
    const filteredTips={x:(this.filters[0].update(a.x*w,now)+this.filters[2].update(b.x*w,now))/(2*w),
      y:(this.filters[1].update(a.y*h,now)+this.filters[3].update(b.y*h,now))/(2*h)};
    const raw=mapHandToStage({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    let filtered=mapHandToStage(filteredTips).point;
    // Accumulate slow motion relative to last accepted position, not last sample.
    const moved=!this.stable||Math.hypot(filtered.x-this.stable.x,filtered.y-this.stable.y)>=config.deadzonePx;
    if(moved)this.stable={...filtered};
    let hand=this.stable!;
    let point=this.capture?relativeTarget(hand,this.capture.hand,this.capture.target):clampStage(hand);
    let started=false;
    if(distance>config.pinch.open){
      if(this.grabbing){
        // Opening fingers must not move the bottle one last time.
        point=this.lastOutput??point;this.grabbing=false;
        this.send({type:'GRAB_END'});this.capture=null;this.lastOutput=null;
      }
      this.closed=false;this.neutralRequired=false;
    }else if(distance<config.pinch.close&&!this.closed&&!this.neutralRequired){
      this.closed=true;
      if(raw.inside&&this.canGrab(point)){
        const target=this.captureTarget?this.captureTarget():{point:{...point},constrain:clampStage};
        if(target){
          // New capture must not inherit filter velocity from the previous drag.
          this.filters.forEach(f=>f.reset());
          [a.x*w,a.y*h,b.x*w,b.y*h].forEach((v,i)=>this.filters[i].update(v,now));
          filtered={...raw.point};hand=this.stable={...raw.point};
          this.capture={hand:{...hand},target:{...target,point:{...target.point}}};
          point={...target.point};this.lastOutput={...point};this.grabbing=true;started=true;
          this.send({type:'GRAB_START',point});
        }
      }
    }
    if(this.grabbing&&this.capture&&(started||moved)){
      const origin=this.capture.target.point;
      this.send({type:'CONTROL_UPDATE',delta:{x:point.x-origin.x,y:point.y-origin.y},
        ...(this.capture.target.trackMotion?{motionPoint:{...hand}}:{})});
      this.lastOutput={...point};
    }
    return {point,grabbing:this.grabbing,available:raw.inside&&this.canGrab(point),insideRoi:raw.inside,
      diagnostics:{distance,pinched:this.closed,grabbing:this.grabbing,neutralRequired:this.neutralRequired,raw:raw.point,filtered,stable:{...hand},target:this.capture?.target.holdInfo?.()}};
  }
}
