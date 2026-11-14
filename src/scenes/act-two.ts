import { BlurFilter, Container, FillGradient, Graphics, Text, type Ticker } from 'pixi.js';
import { actTwoConfig as c } from '../config/act-two.ts';
import { SwallowController } from '../interaction/swallow.ts';
import { createFengMeng } from '../characters/fengmeng.ts';
import { actTwoEntranceAt, houyiDepartureAt } from './act-two-entrance.ts';
import { createImageHouyi } from '../characters/image-rigs.ts';
import { createChangeRig } from '../characters/change.ts';
import { applyLeatherLook } from '../characters/puppet-look.ts';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
function caption(text:string,size:number,color:string):Text {
  const label=new Text({text,style:{fontFamily:'STKaiti, KaiTi, serif',fontSize:size,fill:color,letterSpacing:5}});
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
  private readonly warning=caption('逢蒙逼药，嫦娥护药',38,c.colors.caption);
  private readonly tension=new Graphics();
  private readonly departing=new Container({label:'后羿离家 · 图片影偶'});
  private departureRightExtent=0;
  private readonly title=caption('凡间 · 嫦娥吞药',54,c.colors.caption);
  private readonly introText=caption('后羿离家，逢蒙逼药',29,c.colors.caption);
  private readonly moon=new Graphics();
  private readonly flash=new Graphics();

  get sceneState():string {
    if(this.swallow.state==='intro') return 'scene2_intro';
    if(this.swallow.state==='complete') return 'scene2_complete';
    return this.swallow.state==='swallowing' ? 'scene2_ending':'scene2_interaction';
  }
  constructor() {
    super({label:'第二幕 · 凡间庭院'});
    this.eventMode='none';
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
    this.title.position.set(960,180);this.introText.position.set(960,245);
    this.warning.position.set(960,250);
    this.addChild(this.title,this.introText,this.warning);
    this.seek(0);
  }
  private drawCourtyard():void {
    this.addChild(new Graphics().rect(0,0,1920,1080).fill(c.colors.background));
    const paper=new FillGradient({type:'radial',center:{x:0.43,y:0.46},outerRadius:0.7,
      colorStops:[{offset:0,color:c.colors.light},{offset:1,color:c.colors.courtyard}]});
    this.addChild(new Graphics().rect(45,45,1830,990).fill(paper));
    const architecture=new Graphics().rect(65,830,1790,205).fill('#423b36')
      .poly([90,300,240,218,475,300]).fill('#332d2b')
      .rect(145,303,24,527).rect(400,303,24,527).fill('#3b302b')
      .rect(210,400,145,210).stroke({color:'#74604b',width:8})
      .poly([1390,285,1600,210,1810,285]).fill('#332d2b')
      .rect(1430,290,22,540).rect(1750,290,22,540).fill('#3b302b');
    for(let y=875;y<1030;y+=50) architecture.moveTo(70,y).lineTo(1850,y).stroke({color:'#76604a',width:2,alpha:0.35});
    for(let x=235;x<355;x+=35) architecture.moveTo(x,402).lineTo(x,608).stroke({color:'#74604b',width:3});
    this.addChild(architecture);
    const red=c.tension;
    this.tension.ellipse(red.x,red.y,red.radiusX,red.radiusY).fill(red.color);
    this.tension.filters=[new BlurFilter({strength:65,quality:4,resolution:0.5})];
    this.tension.cacheAsTexture({resolution:0.5});
    this.addChild(this.tension);
    this.moon.circle(1570,155,49).fill('#fce9ba');this.moon.alpha=0.16;this.addChild(this.moon);
    this.addChild(new Graphics().rect(32,32,1856,1016).stroke({color:'#bc9860',width:2,alpha:0.5}));
  }
  private drawChangE():void {
    const shadow=new Graphics().ellipse(c.changE.x,870,150,21).fill({color:'#211c1b',alpha:0.45});
    shadow.filters=[new BlurFilter({strength:10})];this.figure.addChild(shadow);
    applyLeatherLook(this.changeRig.root);
    this.figure.addChild(this.changeRig.root,this.bottle,this.control);
    this.halo.filters=[new BlurFilter({strength:9})];
    this.bottle.addChild(this.halo,new Graphics().roundRect(-9,-15,18,26,6).fill(c.colors.glow)
      .rect(-5,-22,10,8).fill('#d6ad63').circle(-3,-8,3).fill('#fff5d4'));
    const name=caption('嫦娥',24,c.colors.caption);name.position.set(710,907);this.figure.addChild(name);
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
    this.departing.alpha=clamp((t-c.intro.departureStart)/0.35);
    this.departing.visible=departure.visible;
    const entrance=actTwoEntranceAt(t);
    this.pengMeng.position.set(entrance.x,c.pengMeng.y);
    this.pengMeng.visible=t>=c.intro.approachStart;
    this.pengMeng.alpha=1;
    this.warning.alpha=entrance.warningAlpha;
    this.tension.alpha=c.tension.alpha*entrance.progress;
    this.title.alpha=clamp(t/0.7)*(1-clamp((t-2.8)/1.2));
    const approachEnd=c.intro.approachStart+c.intro.approachDuration;
    this.introText.alpha=s.state==='intro'?clamp(t/0.8)*(1-clamp((t-approachEnd+1)/1)):0;
    this.figure.alpha=clamp((t-2.6)/1.2);
    const ending=s.endingElapsed;
    const rise=ease((ending-c.ending.swallowSeconds)/c.ending.riseSeconds);
    this.figure.y=-rise*c.ending.riseHeight;
    this.changeRig.head.rotation=-0.28*Math.sin(clamp(ending/c.ending.swallowSeconds)*Math.PI);
    this.pengMeng.alpha*=1-rise*0.65;
    this.moon.alpha=0.16+rise*0.65;
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
        .stroke({color:'#fff4c2',width:5});
      const start=s.pointAt(0);
      this.guide.moveTo(start.x,start.y).arc(a.center.x,a.center.y,a.radius,a.startAngle,a.endAngle,true)
        .stroke({color:'#f1ce8c',width:2,alpha:0.3});
      const end=s.pointAt(1);this.target.circle(end.x,end.y,34)
        .stroke({color:c.colors.glow,width:2,alpha:0.45});
    }
    this.rods.clear();
    if(this.figure.alpha>0) this.rods.moveTo(670,1050).lineTo(710,680+this.figure.y)
      .moveTo(935,1050).lineTo(p.x,p.y+this.figure.y).stroke({color:'#2e241f',width:4});
    this.rods.alpha=this.figure.alpha*(1-rise);
    this.flash.clear();
    if(rise>0 && rise<1) this.flash.circle(735,600+this.figure.y,75+rise*160)
      .stroke({color:c.colors.glow,width:3,alpha:Math.sin(rise*Math.PI)*0.4});
  }
  dispose():void { this.swallow.dispose(); }
}
