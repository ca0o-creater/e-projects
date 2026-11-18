import { Assets, Rectangle, Sprite, Texture } from 'pixi.js';
import { prologueConfig } from '../config/prologue.config.ts';

// 原图四周有透明留白、右下角还有水印文字；运行时按 crop 只取人物可见区域，
// 水印在裁切区域之外，因此不会带上舞台，原文件也不会被修改。
export async function loadHouyiWalk(): Promise<void> {
  await Assets.load<Texture>(prologueConfig.houyiWalk.url);
}

export function createHouyiWalk(): Sprite {
  const c = prologueConfig.houyiWalk;
  const texture = Assets.get<Texture>(c.url);
  const frame = new Rectangle(c.crop.x, c.crop.y, c.crop.width, c.crop.height);
  const sprite = new Sprite(new Texture({ source: texture.source, frame }));
  sprite.label = '序章 · 后羿走向山门';
  // 锚点放在脚底，y 就是站立的地面线，缩放和浮动都以此为准。
  sprite.anchor.set(0.5, 1);
  return sprite;
}
