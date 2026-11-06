import { BlurFilter, Container, Graphics } from 'pixi.js';
import { charactersConfig as config } from '../config/characters.ts';

// 每个 part 容器只放局部美术。换 Sprite 时沿用容器及局部原点，无需修改关节树。
function part(name: string, x: number, y: number, z: number, art: Graphics): Container {
  const joint = new Container({ label: name });
  joint.position.set(x, y);
  joint.pivot.set(0, 0);
  joint.zIndex = z;
  joint.addChild(art);
  return joint;
}

export function createHouyiRig(color: string) {
  const c = config.houyi;
  const root = new Container({ label: '后羿骨架', sortableChildren: true });
  const legs = part('legs', 0, -125, 0, new Graphics()
    .poly([-30, 0, -4, 0, -10, 111, 14, 116, 14, 126, -42, 126]).fill(color)
    .poly([13, 0, 40, 0, 51, 100, 80, 114, 78, 125, 25, 125]).fill(color));
  const torso = part('torso', c.torso.x, c.torso.y, c.torso.z, new Graphics()
    .poly([-32, -45, 25, -46, 43, -20, 28, 45, 57, 111, -57, 111, -39, 45]).fill(color));
  const head = part('head', c.head.x, c.head.y, c.head.z, new Graphics()
    .moveTo(-24, -28).quadraticCurveTo(11, -53, 26, -22)
    .lineTo(27, -8).lineTo(43, 4).lineTo(28, 10).lineTo(28, 23)
    .quadraticCurveTo(18, 38, 5, 32).lineTo(6, 47).lineTo(-18, 47)
    .lineTo(-16, 18).quadraticCurveTo(-39, 0, -24, -28).closePath().fill(color)
    .circle(-13, -40, 17).fill(color)
    .poly([-24, -20, -47, 18, -39, 53, -29, 14, -9, -17]).fill(color));
  // 两段手臂都沿局部 +Y 向下绘制，(0,0) 分别就是肩和肘。
  const upperArm = part('upperArm / shoulder pivot', c.shoulder.x, c.shoulder.y, c.shoulder.z,
    new Graphics().roundRect(-c.upperArm.width / 2, -12, c.upperArm.width, c.upperArm.length + 24, 14).fill(color));
  const forearm = part('forearm / elbow pivot', 0, c.upperArm.length, 1,
    new Graphics().roundRect(-c.forearm.width / 2, -10, c.forearm.width, c.forearm.length + 10, 10)
      .ellipse(3, c.forearm.length + 7, 12, 17).fill(color));
  upperArm.addChild(forearm);
  upperArm.rotation = c.upperArm.rotation;
  forearm.rotation = c.forearm.rotation;
  // 身后的弓，帮助占位剪影表达后羿身份。
  const bow = part('bow', -48, -220, -1, new Graphics()
    .moveTo(-5, -100).quadraticCurveTo(-93, 10, -5, 123).stroke({ color, width: 8 })
    .moveTo(-5, -100).lineTo(-5, 123).stroke({ color, width: 2 }));
  head.position.set(c.head.x - c.torso.x, c.head.y - c.torso.y);
  upperArm.position.set(c.shoulder.x - c.torso.x, c.shoulder.y - c.torso.y);
  torso.sortableChildren = true;
  torso.addChild(head, upperArm);
  root.addChild(bow, legs, torso);
  return { root, head, torso, upperArm, forearm, legs, bow };
}

function queenRig(color: string) {
  const c = config.queen;
  const root = new Container({ label: '西王母上半身', sortableChildren: true });
  const torso = part('torso', c.torso.x, c.torso.y, c.torso.z, new Graphics()
    .moveTo(-30, -35).lineTo(27, -35).quadraticCurveTo(52, 15, 73, 112)
    .quadraticCurveTo(0, 151, -63, 116).lineTo(-38, 19).closePath().fill(color));
  const head = part('head', c.head.x, c.head.y, c.head.z, new Graphics()
    .moveTo(24, -23).quadraticCurveTo(-15, -47, -26, -17).lineTo(-26, -5)
    .lineTo(-41, 5).lineTo(-27, 12).lineTo(-22, 27).lineTo(-7, 33)
    .lineTo(-8, 48).lineTo(18, 48).lineTo(15, 16).quadraticCurveTo(41, 1, 24, -23)
    .closePath().fill(color)
    .poly([-30, -27, -41, -62, -17, -49, -6, -79, 7, -49, 33, -65, 25, -25]).fill(color)
    .circle(-6, -80, 6).fill(color));
  const arm = part('offeringArm', -25, -10, 30, new Graphics()
    .moveTo(7, -12).lineTo(-35, 14).lineTo(-108, 25).lineTo(-115, 42)
    .lineTo(-56, 69).lineTo(-14, 51).lineTo(23, 8).closePath().fill(color)
    .roundRect(-152, 30, 54, 12, 6).fill(color));
  root.addChild(torso, head, arm);
  return { root, head, torso, arm };
}

// PixiJS 内置 BlurFilter + 偏移的同形剪影，实现下方 DropShadow，不额外安装滤镜包。
function shadowWrapper(rig: Container): Container {
  const shadow = new Container({ label: '向下投影' });
  shadow.position.set(config.shadow.x, config.shadow.y);
  shadow.alpha = config.shadow.alpha;
  shadow.filters = [new BlurFilter({ strength: config.shadow.blur, quality: 3, resolution: 0.5 })];
  shadow.addChild(rig);
  return shadow;
}

export class HouyiPuppet extends Container {
  readonly rig = createHouyiRig(config.ink);
  private readonly shadowRig = createHouyiRig(config.shadow.color);

  constructor() {
    super({ label: '后羿' });
    this.position.set(config.houyi.x, config.houyi.y);
    this.scale.set(config.houyi.scale);
    this.zIndex = config.layers.houyi;
    this.addChild(shadowWrapper(this.shadowRig.root), this.rig.root);
  }

  // 后续可直接操控这两个关节，阴影同步姿态，不会留下静止手臂。
  setArmPose(shoulder: number, elbow: number): void {
    this.rig.upperArm.rotation = this.shadowRig.upperArm.rotation = shoulder;
    this.rig.forearm.rotation = this.shadowRig.forearm.rotation = elbow;
  }
}

export class QueenPuppet extends Container {
  readonly rig = queenRig(config.ink);
  readonly palm = new Container({ label: '掌心 / 药瓶挂点' });
  readonly halo = new Container({ label: '药瓶微光' });

  constructor() {
    super({ label: '西王母与药瓶' });
    this.position.set(config.queen.x, config.queen.y);
    this.scale.set(config.queen.scale);
    this.zIndex = config.layers.queen;
    this.addChild(shadowWrapper(queenRig(config.shadow.color).root), this.rig.root);
    this.palm.position.set(config.queen.palm.x, config.queen.palm.y);
    this.palm.zIndex = config.layers.bottle;
    const c = config.bottle;
    // 圆心在掌心上方一颗半径，底部落在手掌上。
    const bottle = new Container({ label: '药瓶（占位光珠）' });
    bottle.y = -c.radius;
    const halo = new Graphics().circle(0, 0, c.haloRadius).fill(c.haloColor);
    halo.filters = [new BlurFilter({ strength: 14, quality: 4, resolution: 0.5 })];
    halo.cacheAsTexture({ resolution: 1 });
    this.halo.addChild(halo);
    const cast = new Graphics().circle(3, 8, c.radius).fill({ color: config.shadow.color, alpha: 0.4 });
    cast.filters = [new BlurFilter({ strength: 4, quality: 2 })];
    const core = new Graphics().circle(0, 0, c.radius).fill(c.color)
      .circle(-5, -5, 5).fill('#ffffff');
    bottle.addChild(cast, this.halo, core);
    this.palm.addChild(bottle);
    this.rig.root.addChild(this.palm);
  }
}
