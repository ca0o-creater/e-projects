import {Container,Graphics,Text,BlurFilter,type Ticker} from 'pixi.js';
import {scene3Config as c} from '../config/scene3.config.ts';
import {createChangeRig} from '../characters/change.ts';
import {createImageHouyi} from '../characters/image-rigs.ts';
import {applyLeatherLook} from '../characters/puppet-look.ts';
import {AscentController} from '../interaction/ascent.ts';
import {changeRigConfig} from '../config/change-rig.ts';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function mixColor(a:number,b:number,t:number):number{return [16,8,0].reduce((n,s)=>n|(Math.round(mix((a>>s)&255,(b>>s)&255,t))<<s),0);}
export class ActThreeScene extends Container {
 readonly sceneId='ascent-to-moon';readonly ascent=new AscentController(()=>this.emit('story-complete'));
 private elapsed=0;private sky=new Graphics().rect(0,0,c.stage.width,c.stage.height).fill('white');
 private light=new Graphics().ellipse(c.moon.x,c.moon.y,c.light.radiusX,c.light.radiusY).fill('white');
 private moon=new Container();private cloudLayers:Container[]=[];private ground=new Container();
 private puppet=createChangeRig();private hero=createImageHouyi();private control=new Graphics();private rod=new Graphics();
 private title=new Text({text:'第三幕 · 奔月相思',style:{fontFamily:'KaiTi,serif',fontSize:c.title.size,fill:c.title.color}});
 private endingText=new Text({text:'清冷月宫，相思无尽',style:{fontFamily:'KaiTi,serif',fontSize:c.caption.size,fill:c.caption.color}});
 get sceneState():string{return this.ascent.state==='intro'?'scene3_intro':['ending','complete'].includes(this.ascent.state)?'scene3_complete':'scene3_interaction';}
 constructor(){super({label:'第三幕 · 奔月相思'});this.eventMode='none';this.addChild(this.sky,this.light);
 this.light.filters=[new BlurFilter({strength:c.light.blur,quality:3})];this.light.alpha=c.light.alpha;
 const glow=new Graphics().circle(0,0,c.moon.radius*1.4).fill(c.moon.halo);glow.alpha=.24;glow.filters=[new BlurFilter({strength:30})];
 this.moon.addChild(glow,new Graphics().circle(0,0,c.moon.radius).fill(c.moon.color));this.moon.position.set(c.moon.x,c.moon.y);this.addChild(this.moon);
 for(const layer of c.clouds){const group=new Container();for(let row=-1;row<2;row++)for(let i=0;i<c.cloudShape.count;i++){
 const g=new Graphics().ellipse(0,0,c.cloudShape.radiusX,c.cloudShape.radiusY).ellipse(-60,-25,70,45).ellipse(40,-35,80,52).fill(layer.color);
 g.position.set(i*c.cloudShape.spacing-140+(row%2)*90,row*c.cloudShape.wrap);g.scale.set(layer.scale);group.addChild(g);}
 group.alpha=layer.alpha;this.cloudLayers.push(group);this.addChild(group);}
 this.ground.addChild(new Graphics().rect(0,c.ground.y,c.stage.width,200).fill(c.ground.color).moveTo(0,c.ground.y).lineTo(c.stage.width,c.ground.y).stroke({color:c.sky.lightStart,width:3}));
 this.hero.root.tint=c.ground.color;this.ground.addChild(this.hero.root);this.addChild(this.ground,this.rod,this.puppet.root,this.control);
 this.puppet.pose(c.character.restProgress);applyLeatherLook(this.puppet.root);
 this.title.anchor.set(.5);this.title.position.set(c.title.x,c.title.y);this.endingText.anchor.set(.5);this.endingText.position.set(c.caption.x,c.caption.y);this.addChild(this.title,this.endingText);this.seek(0);}
 readonly update=(ticker:Ticker):void=>{const dt=Math.min(ticker.deltaMS/1000,.05);this.elapsed+=dt;if(this.elapsed>=c.introSeconds)this.ascent.prepare();this.ascent.update(dt);this.draw();};
 seek(t:number):void{this.elapsed=t;if(t>=c.introSeconds)this.ascent.prepare();this.draw();}
 private draw():void{const s=this.ascent,e=s.ending*s.ending*(3-2*s.ending),p=mix(s.progress,1,e),a=c.character;
 this.sky.tint=mixColor(c.sky.start,c.sky.end,p);this.light.tint=mixColor(c.sky.lightStart,c.sky.lightEnd,p);
 this.light.y=mix(c.light.startOffsetY,c.light.endOffsetY,p);
 this.moon.scale.set(mix(c.moon.startScale,c.moon.endScale,p));this.moon.alpha=mix(c.moon.startAlpha,c.moon.endAlpha,p);
 this.cloudLayers.forEach((g,i)=>{g.y=c.clouds[i].y+p*c.clouds[i].travel;});
 this.ground.y=p*c.ground.travel;this.ground.alpha=1-p;
 this.hero.root.position.set(c.ground.houyiX,c.ground.houyiY);this.hero.root.scale.set(mix(c.ground.startScale,c.ground.endScale,p));
 this.puppet.root.position.set(mix(a.x,c.ending.characterX,e),mix(mix(a.startY,a.endY,p),c.ending.characterY,e));
 this.puppet.root.scale.set(changeRigConfig.scale*a.scale);
 const point=s.point;this.control.clear();this.rod.clear();
 if(['ready','dragging','armed'].includes(s.state)){
 this.rod.moveTo(point.x+c.rod.footOffsetX,c.stage.height).lineTo(point.x,point.y).stroke({color:c.rod.color,width:c.rod.width});
 this.control.circle(point.x,point.y,c.control.radius).fill({color:c.control.stroke,alpha:.12}).stroke({color:c.control.stroke,width:3});
 if(s.hold>0)this.control.moveTo(point.x,point.y-c.control.radius-8).arc(point.x,point.y,c.control.radius+8,-Math.PI/2,-Math.PI/2+Math.min(1,s.hold/c.control.holdSeconds)*Math.PI*2).stroke({color:c.control.stroke,width:5});}
 this.title.alpha=Math.max(0,1-this.elapsed/c.introSeconds);this.endingText.alpha=e;
 }
 dispose():void{this.ascent.dispose();}
}
