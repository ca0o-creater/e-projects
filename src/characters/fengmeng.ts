import {Assets,Container,Graphics,Sprite,Texture} from 'pixi.js';
import {actTwoConfig as config} from '../config/act-two.ts';
import {applyLeatherLook} from './puppet-look.ts';
import {rigConfig} from '../config/rig.config.ts';
import {changeRigConfig} from '../config/change-rig.ts';

export async function loadActTwoAssets():Promise<void> {
  await Promise.all([Assets.load<Texture>(config.background.url),Assets.load<Texture>(config.pengMeng.url),Assets.load<Texture>(rigConfig.houyi.url),Assets.load<Texture>(changeRigConfig.url)]);
}
export function createFengMeng():Container {
  const c=config.pengMeng,texture=Assets.get<Texture>(c.url);
  const root=new Container({label:'逢蒙 · 皮影图片'}),art=new Container();
  const sprite=new Sprite(texture);
  if(c.usePaperMask) {
    // 原PNG不改写；只在运行时排除纸底、题字与水印。
    sprite.width=c.referenceSize.width;sprite.height=c.referenceSize.height;
    const mask=new Graphics().poly([...c.silhouette]).fill('white');
    for(const hole of c.holes) mask.poly([...hole]).cut();
    art.addChild(sprite,mask);sprite.mask=mask;
    art.pivot.set(c.origin.x,c.origin.y);art.scale.set(c.height/c.visibleHeight);
  } else {
    sprite.anchor.set(0,1);sprite.scale.set(c.height/texture.height);art.addChild(sprite);
  }
  root.addChild(art);root.scale.x=c.flipX?-1:1;applyLeatherLook(root);
  return root;
}
