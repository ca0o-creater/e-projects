import {Assets,Container,Graphics,Text,BlurFilter,Sprite,Texture,Rectangle,FillGradient,type Ticker} from 'pixi.js';
import {scene3Config as c} from '../config/scene3.config.ts';
import {createChangeRig} from '../characters/change.ts';
import {applyLeatherLook} from '../characters/puppet-look.ts';
import {AscentController} from '../interaction/ascent.ts';
import {ascentPoseAt} from './ascent-pose.ts';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export class ActThreeScene extends Container {
 readonly sceneId='ascent-to-moon';readonly ascent=new AscentController(()=>this.emit('story-complete'));
 private elapsed=0;private background=new Container();private night=new Graphics();
 private extensionTexture:Texture;
 private moon=new Container();
 private puppet=createChangeRig();private control=new Graphics();private rod=new Graphics();
 private title=new Text({text:'第三幕 · 奔月相思',style:{fontFamily:'KaiTi,serif',fontSize:c.title.size,fill:c.title.color}});
 private endingText=new Text({text:'清冷月宫，相思无尽',style:{fontFamily:'KaiTi,serif',fontSize:c.caption.size,fill:c.caption.color}});
 get sceneState():string{return this.ascent.state==='intro'?'scene3_intro':['ending','complete'].includes(this.ascent.state)?'scene3_complete':'scene3_interaction';}
 constructor(){super({label:'第三幕 · 奔月相思'});this.eventMode='none';
 const texture=Assets.get<Texture>(c.background.url);
 const scale=Math.max(c.stage.width/texture.width,c.stage.height/texture.height);
 const picture=new Sprite(texture);picture.scale.set(scale);
 picture.position.set((c.stage.width-picture.width)/2,(c.stage.height-picture.height)/2);
 // 从原图顶部无云的纸纹取样，向上延展镜头移动空间，避免下移后顶部露空。
 const region=c.background.extensionRegion;
 this.extensionTexture=new Texture({source:texture.source,frame:new Rectangle(region.x,region.y,region.width,region.height)});
 const extension=new Sprite(this.extensionTexture);extension.position.set(0,-c.background.travel);
 extension.width=c.stage.width;extension.height=c.background.travel+1;
 this.background.addChild(extension,picture);this.addChild(this.background);
 const blue=new FillGradient({type:'linear',start:{x:0,y:0},end:{x:0,y:1},
   colorStops:[{offset:0,color:c.night.top},{offset:1,color:c.night.bottom}]});
 this.night.rect(0,0,c.stage.width,c.stage.height).fill(blue);this.addChild(this.night);
 const glow=new Graphics().circle(0,0,c.moon.radius*1.4).fill(c.moon.halo);glow.alpha=.24;glow.filters=[new BlurFilter({strength:30})];
 this.moon.addChild(glow,new Graphics().circle(0,0,c.moon.radius).fill(c.moon.color));this.moon.position.set(c.moon.x,c.moon.y);this.addChild(this.moon);
 this.addChild(this.rod,this.puppet.root,this.control);
 const cover=c.watermarkCover;
 this.addChild(new Graphics({label:'右下角水印遮挡'}).rect(cover.x,cover.y,cover.width,cover.height).fill({color:cover.color,alpha:cover.alpha}));
 this.puppet.pose(c.character.restProgress);applyLeatherLook(this.puppet.root);
 this.title.anchor.set(.5);this.title.position.set(c.title.x,c.title.y);this.endingText.anchor.set(.5);this.endingText.position.set(c.caption.x,c.caption.y);this.addChild(this.title,this.endingText);this.seek(0);}
 readonly update=(ticker:Ticker):void=>{const dt=Math.min(ticker.deltaMS/1000,.05);this.elapsed+=dt;if(this.elapsed>=c.introSeconds)this.ascent.prepare();this.ascent.update(dt);this.draw();};
 seek(t:number):void{this.elapsed=t;if(t>=c.introSeconds)this.ascent.prepare();this.draw();}
 private draw():void{const s=this.ascent,e=s.ending*s.ending*(3-2*s.ending),p=mix(s.progress,1,e);
 this.background.y=p*c.background.travel;
 this.night.alpha=mix(c.night.startAlpha,c.night.endAlpha,p);
 this.moon.scale.set(mix(c.moon.startScale,c.moon.endScale,p));this.moon.alpha=mix(c.moon.startAlpha,c.moon.endAlpha,p);
 const pose=ascentPoseAt(p);this.puppet.root.position.set(pose.x,pose.y);
 this.puppet.root.scale.set(pose.scale);
 const point=s.point;this.control.clear();this.rod.clear();
 if(['ready','dragging','armed'].includes(s.state)){
 this.rod.moveTo(point.x+c.rod.footOffsetX,c.stage.height).lineTo(point.x,point.y).stroke({color:c.rod.color,width:c.rod.width});
 this.control.circle(point.x,point.y,c.control.radius).fill({color:c.control.stroke,alpha:.12}).stroke({color:c.control.stroke,width:3});
 if(s.hold>0)this.control.moveTo(point.x,point.y-c.control.radius-8).arc(point.x,point.y,c.control.radius+8,-Math.PI/2,-Math.PI/2+Math.min(1,s.hold/c.control.holdSeconds)*Math.PI*2).stroke({color:c.control.stroke,width:5});}
 this.title.alpha=Math.max(0,1-this.elapsed/c.introSeconds);this.endingText.alpha=e;
 }
 dispose():void{this.ascent.dispose();this.extensionTexture.destroy(false);}
}
