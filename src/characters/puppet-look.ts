import { Container, Graphics } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { puppetLook as config } from '../config/puppet-look.ts';

export function applyLeatherLook(root:Container):void {
  root.blendMode='multiply';
  // 先以正常颜色绘入透明滤镜纹理，再将完整影偶正片叠底到幕布。
  // 子部件直接 multiply 会与离屏纹理的透明黑相乘，整个人物变黑。
  for(const child of root.children) child.blendMode='normal';
  const glow=new GlowFilter({...config.glow});
  glow.blendMode='multiply';
  root.filters=[glow];
}

export function rivet():Graphics {
  const c=config.rivet;
  return new Graphics().circle(0,0,c.radius).fill(c.color)
    .circle(0,0,c.radius-2).fill(c.metal)
    .circle(0,0,2).fill(c.color)
    .arc(0,0,c.radius-1,Math.PI,Math.PI*1.6).stroke({color:c.highlight,width:1.4,alpha:0.9});
}
