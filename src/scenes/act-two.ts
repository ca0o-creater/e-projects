import { Assets, BlurFilter, Circle, Rectangle, Container, Graphics, Sprite, Text, type Texture, type Ticker } from 'pixi.js';
import {moonExitAt} from './moon-exit.ts';
import { scene2Config as c } from '../config/scene2.config.ts';
import { SwallowController } from '../interaction/swallow.ts';
import { createFengMeng } from '../characters/fengmeng.ts';
import { actTwoEntranceAt, houyiDepartureAt } from './act-two-entrance.ts';
import { createImageHouyi } from '../characters/image-rigs.ts';
import { createChangeRig } from '../characters/change.ts';
import { applyLeatherLook } from '../characters/puppet-look.ts';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
function caption(text:string,size:number,color:string):Text {
  const label=new Text({text,style:{fontFamily:'STKaiti, KaiTi, serif',fontSize:size,fill:color,letterSpacing:5,
    dropShadow:{color:'#171415',alpha:0.95,blur:6,distance:2}}});
  label.anchor.set(0.5);return label;
}

export class ActTwoScene extends Container {
  readonly sceneId='change-takes-elixir';
  readonly swallow=new SwallowController(()=>this.emit('moon-unlocked'));
  private elapsed=0;
  private readonly figure=new Container({label:'嫦娥图片与交互'});
  private readonly changeRig=createChangeRig();
  private readonly rods=new Graphics();
  private readonly bottle=new Container({label:'掌心药瓶'});
  private readonly halo=new Graphics().circle(0,0,27).fill({color:c.colors.glow,alpha:0.4});
  private readonly control=new Graphics();
  private readonly guide=new Graphics();
  private readonly target=new Graphics();
  private readonly pengMeng=createFengMeng();
  private readonly warning=caption(c.captions.warningText,38,c.colors.caption);
  private readonly tension=new Graphics();
  private readonly departing=new Container({label:'后羿离家 · 图片影偶'});
  private departureRightExtent=0;
  private readonly title=caption('凡间 · 嫦娥吞药',54,c.colors.caption);
  private readonly introText=caption('后羿离家，逢蒙逼药',29,c.colors.caption);
  private readonly moon=new Container({label:'点击明月前往月宫'});
  private readonly skyHit=new Container({label:'天空转场容错区'});
  private navigating=false;
  private readonly flash=new Graphics();

  get sceneState():string {
    if(this.swallow.state==='intro') return 'scene2_intro';
    if(this.swallow.state==='complete') return 'scene2_complete';
    return this.swallow.state==='swallowing' ? 'scene2_ending':'scene2_interaction';
  }
  constructor() {
    super({label:'第二幕 · 凡间庭院'});
    this.eventMode='passive';
    this.drawCourtyard();
    const houyi=createImageHouyi();
    houyi.root.scale.set(-c.departingHouyi.scale,c.departingHouyi.scale);
    applyLeatherLook(houyi.root);
    this.departing.addChild(houyi.root);
    // 按镜像后实际美术边界计算终点，包含弓与衣摆，确保完整走出左边缘。
    const bounds=this.departing.getLocalBounds();
    this.departureRightExtent=bounds.maxX+12;
    this.addChild(this.departing,this.pengMeng,this.guide,this.target,this.rods,this.figure,this.flash);
    this.drawChangE();
    this.title.position.copyFrom(c.captions.title);this.introText.position.copyFrom(c.captions.intro);
    this.warning.position.copyFrom(c.captions.warning);
    this.addChild(this.title,this.introText,this.warning);
    const m=c.moon;
    const glow=new Graphics().circle(0,0,m.haloRadius).fill({color:m.color,alpha:m.haloAlpha});
    glow.filters=[new BlurFilter({strength:12})];
    this.moon.addChild(glow,new Graphics().circle(0,0,m.radius).fill(m.color));
    this.moon.position.set(m.x,m.y);this.moon.hitArea=new Circle(0,0,m.hitRadius);
    this.skyHit.hitArea=new Rectangle(0,0,c.stage.width,m.skyHitHeight);
    this.moon.cursor=this.skyHit.cursor='pointer';
    this.moon.on('pointertap',event=>{event.stopPropagation();if(event.button===0)this.requestMoon();});
    this.skyHit.on('pointertap',event=>{if(event.button===0)this.requestMoon();});
    this.addChild(this.skyHit,this.moon);
    this.seek(0);
  }
  private drawCourtyard():void {
    this.addChild(new Graphics().rect(0,0,1920,1080).fill(c.colors.background));
    const bg=c.background,texture=Assets.get<Texture>(bg.url);
    const courtyard=new Sprite({texture,label:'庭院原画 · 树与房屋整体构图'});
    courtyard.anchor.set(bg.flipX?1:0,0);
    courtyard.scale.set(bg.flipX?-bg.scale:bg.scale,bg.scale);
    courtyard.position.set(bg.x,bg.y);this.addChild(courtyard);
    // 夜色只压暗庭院与月亮，人物和交互提示在遮罩之上。
    this.addChild(new Graphics({label:'庭院夜色遮罩'}).rect(0,0,c.stage.width,c.stage.height)
      .fill({color:0x000000,alpha:bg.nightOpacity}));
    const red=c.tension;
    this.tension.ellipse(red.x,red.y,red.radiusX,red.radiusY).fill(red.color);
    this.tension.filters=[new BlurFilter({strength:65,quality:4,resolution:0.5})];
    this.tension.cacheAsTexture({resolution:0.5});
    this.addChild(this.tension);
  }
  private drawChangE():void {
    this.changeRig.root.position.set(c.changE.x,c.changE.y);
    this.changeRig.root.scale.set(c.changE.flipX?-c.changE.scale:c.changE.scale,c.changE.scale);
    const shadow=new Graphics().ellipse(c.changE.x,c.changE.y+10,c.shadow.radiusX,c.shadow.radiusY).fill({color:'#211c1b',alpha:0.45});
    shadow.filters=[new BlurFilter({strength:10})];this.figure.addChild(shadow);
    applyLeatherLook(this.changeRig.root);
    this.figure.addChild(this.changeRig.root,this.bottle,this.control);
    this.halo.filters=[new BlurFilter({strength:9})];
    this.bottle.addChild(this.halo,new Graphics().roundRect(-9,-15,18,26,6).fill(c.colors.glow)
      .rect(-5,-22,10,8).fill('#d6ad63').circle(-3,-8,3).fill('#fff5d4'));
  }
  readonly update=(ticker:Ticker):void=>{
    const dt=Math.min(ticker.deltaMS/1000,0.05);
    this.elapsed+=dt;
    if(actTwoEntranceAt(this.elapsed).unlocked) this.swallow.prepare();
    this.swallow.update(dt);
    this.renderPose();
  };
  seek(seconds:number):void {
    this.elapsed=Math.max(0,seconds);
    if(actTwoEntranceAt(this.elapsed).unlocked) this.swallow.prepare();
    this.renderPose();
  }
  private renderPose():void {
    const t=this.elapsed, s=this.swallow;
    const departure=houyiDepartureAt(t,this.departureRightExtent);
    this.departing.position.set(departure.x,c.departingHouyi.y);
    this.departing.alpha=departure.alpha;
    this.departing.visible=departure.visible;
    const entrance=actTwoEntranceAt(t);
    this.pengMeng.position.set(entrance.x,entrance.y);
    this.pengMeng.visible=t>=c.intro.approachStart;
    this.pengMeng.alpha=1;
    this.warning.alpha=entrance.warningAlpha;
    this.tension.alpha=c.tension.alpha*entrance.progress;
    this.title.alpha=clamp(t/0.7)*(1-clamp((t-2.8)/1.2));
    const approachEnd=c.intro.approachStart+c.intro.approachDuration;
    this.introText.alpha=s.state==='intro'?clamp(t/0.8)*(1-clamp((t-approachEnd+1)/1)):0;
    this.figure.alpha=clamp(t/1.2);
    const ending=s.endingElapsed;
    const rise=ease((ending-c.ending.swallowSeconds)/c.ending.riseSeconds);
    this.figure.y=-rise*c.ending.riseHeight;
    this.changeRig.head.rotation=-0.28*Math.sin(clamp(ending/c.ending.swallowSeconds)*Math.PI);
    this.pengMeng.alpha*=1-rise*0.65;
    const exit=moonExitAt(s.state,ending);
    this.moon.alpha=exit.alpha;
    this.moon.eventMode=this.skyHit.eventMode=exit.enabled&&!this.navigating?'static':'none';
    const a=c.arm;
    this.changeRig.pose(s.progress);
    // 从真实掌心挂点读取坐标，控制圈、瓶子、手杆始终与原图手掌一致。
    const palm=this.figure.toLocal(this.changeRig.palmNode.toGlobal({x:0,y:0}));
    this.bottle.position.set(palm.x,palm.y-10);
    const p=palm;
    this.bottle.alpha=1-ease(ending/c.ending.swallowSeconds);
    this.halo.alpha=0.65+Math.sin(t*3)*0.12;
    const interactive=['ready','dragging','armed','returning'].includes(s.state);
    this.control.clear();this.guide.clear();this.target.clear();
    if(interactive) {
      this.control.circle(p.x,p.y,a.controlRadius).stroke({color:s.state==='armed'?'#fff7ce':'#f1ce8c',width:3})
        .circle(p.x,p.y,a.controlRadius+7).stroke({color:c.colors.glow,width:1,alpha:0.35});
      if(s.holdProgress>0) this.control.moveTo(p.x,p.y-a.controlRadius-7)
        .arc(p.x,p.y,a.controlRadius+7,-Math.PI/2,-Math.PI/2+s.holdProgress*Math.PI*2)
        .stroke({color:'#91ffbe',width:10});
      const start=s.pointAt(0);
      this.guide.moveTo(start.x,start.y).arc(a.center.x,a.center.y,a.radius,a.startAngle,a.endAngle,a.endAngle<a.startAngle)
        .stroke({color:'#f1ce8c',width:2,alpha:0.3});
      const end=s.targetCenter;this.target.circle(end.x,end.y,a.stableRadius)
        .fill({color:s.inTarget?'#91ffbe':c.colors.glow,alpha:s.inTarget?0.16:0.04})
        .stroke({color:s.inTarget?'#91ffbe':c.colors.glow,width:s.inTarget?4:2,alpha:s.inTarget?0.9:0.45});
    }
    this.rods.clear();
    if(this.figure.alpha>0) this.rods.moveTo(c.changE.x+c.rods.bodyFootOffsetX,1080)
      .lineTo(c.changE.x+c.rods.bodyOffsetX,c.changE.y+c.rods.bodyOffsetY+this.figure.y)
      .moveTo(c.changE.x+c.rods.handFootOffsetX,1080).lineTo(p.x,p.y+this.figure.y).stroke({color:'#2e241f',width:4});
    this.rods.alpha=this.figure.alpha*(1-rise);
    this.flash.clear();
    if(rise>0 && rise<1) this.flash.circle(c.changE.x+15,c.changE.y-260+this.figure.y,75+rise*160)
      .stroke({color:c.colors.glow,width:3,alpha:Math.sin(rise*Math.PI)*0.4});
  }
  get transitionMessage():string {
    if(this.swallow.state==='complete')return '月宫地点已解锁\n点击天上明月，前往月宫';
    if(this.swallow.state==='swallowing'&&this.swallow.endingElapsed>=c.ending.swallowSeconds)return '点击天上明月，前往月宫';
    return this.swallow.message;
  }
  private requestMoon():void {
    if(this.navigating||!moonExitAt(this.swallow.state,this.swallow.endingElapsed).enabled)return;
    this.navigating=true;this.moon.eventMode=this.skyHit.eventMode='none';this.emit('navigate-to-moon');
  }
  dispose():void { this.navigating=true;this.moon.removeAllListeners();this.skyHit.removeAllListeners();this.swallow.dispose(); }
}
