import { BlurFilter, Container, FillGradient, Graphics, Text, type Ticker } from 'pixi.js';
import { actTwoConfig as c } from '../config/act-two.ts';
import { SwallowController } from '../interaction/swallow.ts';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
function caption(text:string,size:number,color:string):Text {
  const label=new Text({text,style:{fontFamily:'STKaiti, KaiTi, serif',fontSize:size,fill:color,letterSpacing:5}});
  label.anchor.set(0.5);return label;
}
function traveler(color:string):Container {
  const figure=new Container();
  figure.addChild(new Graphics().circle(0,-310,35).fill(color)
    .poly([-35,-275,32,-275,70,-90,35,-45,-45,-45,-68,-95]).fill(color)
    .poly([-38,-60,-5,-60,-27,0,-75,0]).fill(color)
    .poly([5,-60,36,-60,75,0,35,0]).fill(color)
    .moveTo(25,-248).lineTo(85,-180).lineTo(125,-214).stroke({color,width:22,cap:'round'}));
  return figure;
}

export class ActTwoScene extends Container {
  readonly sceneId='change-takes-elixir';
  readonly swallow=new SwallowController(()=>this.emit('moon-unlocked'));
  private elapsed=0;
  private readonly figure=new Container({label:'嫦娥占位影偶'});
  private readonly head=new Container({label:'仰头节点'});
  private readonly arm=new Graphics();
  private readonly rods=new Graphics();
  private readonly bottle=new Container({label:'掌心药瓶'});
  private readonly halo=new Graphics().circle(0,0,27).fill({color:c.colors.glow,alpha:0.4});
  private readonly control=new Graphics();
  private readonly guide=new Graphics();
  private readonly target=new Graphics();
  private readonly pengMeng=traveler(c.colors.ink);
  private readonly departing=traveler('#c1a574');
  private readonly title=caption('凡间 · 嫦娥吞药',54,c.colors.caption);
  private readonly introText=caption('后羿离家，逢蒙逼近',29,c.colors.caption);
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
    this.pengMeng.scale.x=-1;
    this.departing.addChild(new Graphics().moveTo(-50,-345).quadraticCurveTo(-150,-185,-50,-45)
      .stroke({color:'#c1a574',width:7}).moveTo(-50,-345).lineTo(-50,-45).stroke({color:'#c1a574',width:2}));
    this.addChild(this.departing,this.pengMeng,this.guide,this.target,this.rods,this.figure,this.flash);
    this.drawChangE();
    this.title.position.set(960,180);this.introText.position.set(960,245);
    this.addChild(this.title,this.introText);
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
    this.moon.circle(1570,155,49).fill('#fce9ba');this.moon.alpha=0.16;this.addChild(this.moon);
    this.addChild(new Graphics().rect(32,32,1856,1016).stroke({color:'#bc9860',width:2,alpha:0.5}));
  }
  private drawChangE():void {
    const shadow=new Graphics().ellipse(c.changE.x,870,150,21).fill({color:'#211c1b',alpha:0.45});
    shadow.filters=[new BlurFilter({strength:10})];this.figure.addChild(shadow);
    this.figure.addChild(new Graphics()
      .poly([694,540,753,536,785,637,828,851,614,851,668,630]).fill(c.colors.changE)
      .poly([704,566,728,570,751,839,694,839]).fill({color:c.colors.trim,alpha:0.45})
      .moveTo(682,571).quadraticCurveTo(615,638,656,710).lineTo(716,688).stroke({color:'#4d3530',width:25,cap:'round'})
      .moveTo(632,829).quadraticCurveTo(718,864,817,830).stroke({color:c.colors.trim,width:5}));
    this.head.position.set(735,538);
    this.head.addChild(new Graphics().ellipse(1,-48,31,43).fill('#d2aa72')
      .poly([25,-59,45,-43,26,-35]).fill('#d2aa72')
      .ellipse(-10,-67,30,37).fill(c.colors.ink).circle(-18,-105,21).fill(c.colors.ink)
      .moveTo(-36,-105).lineTo(13,-116).stroke({color:c.colors.trim,width:4})
      .circle(20,-56,3).fill(c.colors.ink));
    this.figure.addChild(this.head,this.arm,this.bottle,this.control);
    this.halo.filters=[new BlurFilter({strength:9})];
    this.bottle.addChild(this.halo,new Graphics().roundRect(-9,-15,18,26,6).fill(c.colors.glow)
      .rect(-5,-22,10,8).fill('#d6ad63').circle(-3,-8,3).fill('#fff5d4'));
    const name=caption('嫦娥',24,c.colors.caption);name.position.set(710,907);this.figure.addChild(name);
  }
  readonly update=(ticker:Ticker):void=>{
    const dt=Math.min(ticker.deltaMS/1000,0.05);
    this.elapsed+=dt;
    if(this.elapsed>=c.intro.duration) this.swallow.prepare();
    this.swallow.update(dt);
    this.renderPose();
  };
  seek(seconds:number):void {
    this.elapsed=Math.max(0,seconds);
    if(this.elapsed>=c.intro.duration) this.swallow.prepare();
    this.renderPose();
  }
  private renderPose():void {
    const t=this.elapsed, s=this.swallow;
    const departure=clamp((t-c.intro.departureStart)/c.intro.departureDuration);
    this.departing.position.set(740-900*ease(departure),865);
    this.departing.alpha=Math.sin(departure*Math.PI)*0.5;
    this.departing.visible=departure>0 && departure<1;
    const approach=ease((t-c.intro.approachStart)/c.intro.approachDuration);
    this.pengMeng.position.set(c.pengMeng.startX+(c.pengMeng.endX-c.pengMeng.startX)*approach,c.pengMeng.y);
    this.pengMeng.alpha=clamp((t-3)/1.2);
    this.title.alpha=clamp(t/0.7)*(1-clamp((t-2.8)/1.2));
    this.introText.alpha=s.state==='intro'?clamp(t/0.8)*(1-clamp((t-6.5)/1.5)):0;
    this.figure.alpha=clamp((t-2.6)/1.2);
    const ending=s.endingElapsed;
    const rise=ease((ending-c.ending.swallowSeconds)/c.ending.riseSeconds);
    this.figure.y=-rise*c.ending.riseHeight;
    this.head.rotation=-0.28*Math.sin(clamp(ending/c.ending.swallowSeconds)*Math.PI);
    this.pengMeng.alpha*=1-rise*0.65;
    this.moon.alpha=0.16+rise*0.65;
    const p=s.point,a=c.arm;
    this.arm.clear().moveTo(c.changE.shoulder.x,c.changE.shoulder.y).lineTo(a.center.x,a.center.y)
      .lineTo(p.x,p.y).stroke({color:'#6b4033',width:24,cap:'round',join:'round'})
      .circle(a.center.x,a.center.y,7).fill(c.colors.trim).circle(p.x,p.y,12).fill('#d2aa72');
    this.bottle.position.set(p.x,p.y-10);
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
