import { BlurFilter, Container, FillGradient, Graphics, Rectangle, Text, type Ticker } from 'pixi.js';
import { actOneConfig as config } from '../config/act-one';
import { charactersConfig as actors, actOneIntroEnd } from '../config/characters';
import { HouyiPuppet, QueenPuppet } from '../characters/puppets';
import { receivingHand, receivingPose } from '../characters/poses';
import { handoffConfig } from '../config/handoff';
import { HandoffController } from '../interaction/handoff';

const { width, height } = config.stage;

function softShadow(): Container {
  const shadow = new Container();
  shadow.position.set(config.shadows.offsetX, config.shadows.offsetY);
  shadow.alpha = config.shadows.alpha;
  shadow.filters = [new BlurFilter({ strength: config.shadows.blur, quality: 3, resolution: 0.5 })];
  return shadow;
}

function cloudShape(color: string): Graphics {
  return new Graphics().moveTo(-190, 20)
    .bezierCurveTo(-240, 18, -225, -15, -175, -17)
    .bezierCurveTo(-160, -65, -87, -65, -65, -29)
    .bezierCurveTo(-30, -77, 45, -67, 59, -26)
    .bezierCurveTo(116, -55, 167, -30, 158, 0)
    .bezierCurveTo(230, -8, 234, 27, 178, 32)
    .bezierCurveTo(95, 46, -110, 41, -190, 20).closePath().fill(color);
}

function roughRidge(points: number[]): number[] {
  const result = [points[0], points[1]];
  for (let i = 2; i < points.length; i += 2) {
    const x0 = points[i - 2], y0 = points[i - 1], x1 = points[i], y1 = points[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const noise = j === steps ? 0 : Math.sin(i * 9.7 + j * 4.1) * config.mountains.roughness;
      result.push(x0 + (x1 - x0) * t + noise, y0 + (y1 - y0) * t);
    }
  }
  return result;
}

export class ActOneScene extends Container {
  readonly sceneId = 'houyi-gets-elixir';
  phase = 'establishing';
  private elapsed = 0;
  private readonly glow = new Container();
  private readonly cloudLayers: Container[] = [];
  private readonly inscription = new Container();
  readonly houyi = new HouyiPuppet();
  readonly queen = new QueenPuppet();
  readonly handoff = new HandoffController(receivingHand, () => this.emit('handoff-complete'));
  private readonly interactionLayer = new Container({ label: '药瓶交接与光效' });
  private readonly trail: { graphic: Graphics; age: number }[] = [];
  private readonly success = new Graphics();
  private trailClock = 0;
  private trailIndex = 0;
  private detached = false;

  constructor() {
    super();
    this.label = '第一幕 · 后羿得药';
    this.eventMode = 'none';
    this.drawPaper();
    this.drawMountains();
    this.drawClouds();
    const cast = new Container({ label: '人物表演层', sortableChildren: true });
    cast.addChild(this.houyi, this.queen);
    this.addChild(cast);
    this.drawTitle();
    this.drawFrame();
    this.addChild(this.interactionLayer);
    for (let i = 0; i < handoffConfig.trail.count; i++) {
      const graphic = new Graphics().circle(0, 0, handoffConfig.trail.radius).fill({ color: actors.bottle.haloColor, alpha: 0.3 })
        .circle(0, 0, 8).fill({ color: actors.bottle.color, alpha: 0.5 });
      graphic.visible = false;
      this.interactionLayer.addChild(graphic);
      this.trail.push({ graphic, age: handoffConfig.trail.lifetime });
    }
    this.interactionLayer.addChild(this.success);
    this.seek(0);
  }

  readonly update = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.seek(this.elapsed + dt);
    this.updateHandoff(dt);
  };

  private updateHandoff(dt: number): void {
    const c = handoffConfig;
    this.handoff.update(dt);
    this.queen.setOfferingPose(c.offering.startAngle + (c.offering.endAngle - c.offering.startAngle) * this.handoff.offerProgress);
    if (this.handoff.offerProgress === 1 && !this.detached) {
      // 换父容器时保持舞台坐标；之后药瓶只受交接状态机控制。
      const start = this.toLocal(this.queen.bottle.toGlobal({ x: 0, y: 0 }));
      this.interactionLayer.addChild(this.queen.bottle);
      this.queen.bottle.rotation = 0;
      this.queen.bottle.position.copyFrom(start);
      this.handoff.setPath(start);
      this.detached = true;
      this.handoff.update(0);
    }
    const pose = receivingPose(this.handoff.armProgress);
    this.houyi.setArmPose(pose.shoulder, pose.elbow);
    const completing = this.handoff.state === 'completing' || this.handoff.state === 'complete';
    if (this.detached) {
      const point = completing && this.handoff.completionProgress > 0
        ? receivingHand(this.handoff.armProgress) : this.handoff.point;
      this.queen.bottle.position.copyFrom(point);
      this.queen.bottle.alpha = 1 - this.handoff.completionProgress;
      this.queen.bottle.visible = this.handoff.state !== 'complete';
    }
    this.trailClock += dt;
    if (this.handoff.state === 'dragging' && this.trailClock >= c.trail.interval) {
      const particle = this.trail[this.trailIndex++ % this.trail.length];
      particle.age = 0;
      particle.graphic.position.copyFrom(this.handoff.point);
      this.trailClock = 0;
    }
    for (const particle of this.trail) {
      particle.age += dt;
      const life = Math.max(0, 1 - particle.age / c.trail.lifetime);
      particle.graphic.visible = life > 0;
      particle.graphic.alpha = life * 0.5;
      particle.graphic.scale.set(0.3 + life * 0.7);
    }
    this.success.clear();
    const p = this.handoff.completionProgress;
    if (completing && p > 0 && p < 1) {
      const at = receivingHand(1);
      this.success.position.copyFrom(at);
      this.success.circle(0, 0, 20 + p * c.success.radius).stroke({ color: c.success.color, alpha: (1 - p) * 0.8, width: 4 });
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, r = 25 + p * c.success.radius;
        this.success.circle(Math.cos(a) * r, Math.sin(a) * r, 3 + (1 - p) * 4).fill({ color: c.success.color, alpha: 1 - p });
      }
    }
  }

  // 呼吸、云和题字共用播放时间；退出全屏时 ticker 停止，重新进入从原处继续。
  seek(seconds: number): void {
    this.elapsed = Math.max(0, seconds);
    this.cloudLayers.forEach((layer, index) => {
      layer.x = -((this.elapsed * config.clouds[index].speed) % width);
    });
    this.glow.alpha = config.light.alpha + config.light.breathAmplitude
      * Math.sin(this.elapsed * Math.PI * 2 / config.light.breathPeriod);
    const title = config.title;
    const clamp = (t: number) => Math.max(0, Math.min(1, t));
    const houyiProgress = clamp((this.elapsed - actors.houyi.appearAt) / actors.houyi.fadeDuration);
    this.houyi.alpha = houyiProgress;
    const queenProgress = clamp((this.elapsed - actors.queen.appearAt) / actors.queen.enterDuration);
    this.queen.alpha = queenProgress;
    this.queen.y = actors.queen.startY + (actors.queen.y - actors.queen.startY) * (1 - (1 - queenProgress) ** 3);
    const arrival = actors.queen.appearAt + actors.queen.enterDuration;
    const glowTime = Math.max(0, this.elapsed - arrival);
    this.queen.halo.alpha = clamp(glowTime / actors.bottle.glowFadeDuration)
      * (actors.bottle.glowAlpha + actors.bottle.pulseAmplitude
        * Math.sin(glowTime * Math.PI * 2 / actors.bottle.pulsePeriod));
    const t = this.elapsed - title.delay;
    const progress = t < 0 ? 0 : 1 - (1 - Math.min(t / title.enter, 1)) ** 3;
    const fadeAt = title.delay + title.enter + title.hold;
    const fade = clamp((this.elapsed - fadeAt) / title.exit);
    this.inscription.y = title.startY + (title.endY - title.startY) * progress;
    this.inscription.alpha = progress * (1 - fade);
    this.inscription.visible = this.inscription.alpha > 0;
    this.phase = t < 0 ? 'establishing' : t < title.enter ? 'title-enter'
      : this.elapsed < fadeAt ? 'title-hold' : fade < 1 ? 'title-exit'
      : this.elapsed < actOneIntroEnd ? 'characters-enter' : 'awaiting-elixir';
    if (this.phase === 'awaiting-elixir') this.handoff.prepare();
    if (this.handoff.state === 'intro') this.queen.setOfferingPose(handoffConfig.offering.startAngle);
  }

  private drawPaper(): void {
    const paper = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 },
      outerRadius: 0.72, textureSize: 512,
      colorStops: [{ offset: 0, color: config.colors.background },
        { offset: 0.42, color: config.colors.background }, { offset: 1, color: config.colors.paperEdge }],
    });
    this.addChild(new Graphics().rect(0, 0, width, height).fill(paper));
    const light = config.light;
    const gradient = new FillGradient({ type: 'radial', outerRadius: 0.5, textureSize: 512,
      colorStops: [{ offset: 0, color: config.colors.lamplight },
        { offset: 0.2, color: config.colors.lamplight },
        { offset: 0.65, color: '#ffe4a652' }, { offset: 1, color: '#ffe4a600' }],
    });
    const lamp = new Graphics().ellipse(light.centerX, light.centerY, light.radiusX, light.radiusY).fill(gradient);
    lamp.filters = [new BlurFilter({ strength: light.blur, quality: 4, resolution: 0.5 })];
    lamp.filterArea = new Rectangle(0, 0, width, height);
    // 缓存静态滤镜；仅改变外层透明度，避免每帧重新处理整张幕布。
    lamp.cacheAsTexture({ resolution: 1 });
    this.glow.addChild(lamp);
    this.addChild(this.glow);
    const fibers = new Graphics();
    let seed = 1729;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 5000; i++) {
      const x = random() * width, y = random() * height;
      fibers.moveTo(x, y).lineTo(x + 2 + random() * 9, y + random() * 2 - 1)
        .stroke({ color: i % 2 ? config.colors.shadow : config.colors.lamplight, alpha: 0.035, width: 0.6 });
    }
    fibers.cacheAsTexture({ resolution: 1 });
    this.addChild(fibers);
  }

  private drawMountains(): void {
    const ridges = [
      [0, 430, 58, 360, 105, 445, 165, 320, 205, 410, 248, 520, 295, 495, 340, 680, 375, 735, 420, 920, 460, 1080],
      [0, 605, 65, 470, 103, 560, 150, 505, 185, 690, 220, 650, 280, 820, 315, 800, 355, 980, 390, 1080],
      [0, 800, 65, 665, 100, 745, 145, 700, 185, 860, 232, 820, 270, 950, 330, 1080],
    ];
    for (const side of [-1, 1]) {
      const bank = new Container();
      bank.label = side === -1 ? '左侧山峦' : '右侧山峦';
      bank.x = side === 1 ? width : 0;
      bank.scale.x = side === 1 ? -1 : 1;
      ridges.forEach((ridge, index) => {
        const scaled = ridge.map((value, i) => i % 2 === 0 ? value * config.mountains.edgeWidth / 460
          : Math.min(height, value + (side === 1 && i < ridge.length - 1 ? 45 * Math.sin(i) : 0)));
        const edge = roughRidge(scaled), polygon = [...edge, 0, height];
        const shadow = softShadow();
        shadow.addChild(new Graphics().poly(polygon).fill(config.colors.shadow));
        shadow.cacheAsTexture({ resolution: 1 });
        const mountain = new Graphics().poly(polygon).fill(config.colors.mountains[index]);
        mountain.moveTo(edge[0], edge[1]);
        for (let i = 2; i < edge.length; i += 2) mountain.lineTo(edge[i], edge[i + 1]);
        mountain.stroke({ color: config.colors.ridge, width: 1.5, alpha: 0.35 });
        mountain.moveTo(105 - index * 15, 595 + index * 105)
          .bezierCurveTo(80, 705, 175, 740, 185, 900)
          .stroke({ color: config.colors.ridge, alpha: 0.18, width: 2 });
        bank.addChild(shadow, mountain);
      });
      this.addChild(bank);
    }
  }

  private drawClouds(): void {
    config.clouds.forEach((settings, index) => {
      const layer = new Container(), silhouettes = new Container();
      layer.label = `顶部云纹 ${settings.speed} px/s`;
      const shadow = softShadow();
      shadow.filterArea = new Rectangle(0, 0, width, 300);
      for (const tile of [-1, 0, 1, 2]) {
        for (let i = 0; i < 3; i++) {
          const x = tile * width + i * 640 + 170 + index * 190;
          const y = settings.y + (i % 2) * 12;
          const cloud = cloudShape(settings.color);
          cloud.moveTo(-181, 7).bezierCurveTo(-164, -35, -94, -35, -110, -5)
            .bezierCurveTo(-128, 14, -151, -3, -135, -10)
            .moveTo(-62, 5).bezierCurveTo(-28, -38, 33, -37, 28, -8)
            .bezierCurveTo(14, 15, -13, 6, -4, -4)
            .moveTo(64, 16).bezierCurveTo(95, -12, 161, -14, 183, 16)
            .stroke({ color: '#edf0df', width: 2.5, alpha: 0.60 });
          const cast = cloudShape(config.colors.shadow);
          for (const graphic of [cloud, cast]) {
            graphic.position.set(x, y);
            graphic.scale.set(settings.scale, settings.scale * 0.85);
            graphic.alpha = settings.alpha;
          }
          shadow.addChild(cast);
          silhouettes.addChild(cloud);
        }
      }
      layer.addChild(shadow, silhouettes);
      this.cloudLayers.push(layer);
      this.addChild(layer);
    });
  }

  private drawTitle(): void {
    const { colors, title } = config;
    this.inscription.x = width / 2;
    const ornament = new Graphics().moveTo(-350, -65).lineTo(-45, -65)
      .moveTo(45, -65).lineTo(350, -65).stroke({ color: colors.gold, width: 2 })
      .poly([0, -75, 10, -65, 0, -55, -10, -65]).fill(colors.gold);
    const text = new Text({ text: title.text, style: {
      fontFamily: [...title.fontFamily], fontSize: title.fontSize, fill: colors.title, letterSpacing: 8,
      dropShadow: { color: colors.shadow, alpha: 0.18, blur: 2, distance: 2, angle: Math.PI / 2 },
    } });
    text.anchor.set(0.5);
    const seal = new Graphics().roundRect(-23, 76, 46, 46, 3).fill(colors.seal);
    const mark = new Text({ text: '壹', style: { fontFamily: [...title.fontFamily], fontSize: 28, fill: '#ffe5ad' } });
    mark.anchor.set(0.5); mark.y = 99;
    this.inscription.addChild(ornament, text, seal, mark);
    this.addChild(this.inscription);
  }

  private drawFrame(): void {
    const { frame, gold } = config.colors;
    const border = new Graphics().rect(0, 0, width, 30).rect(0, height - 25, width, 25)
      .rect(0, 0, 28, height).rect(width - 28, 0, 28, height).fill(frame)
      .rect(38, 40, width - 76, height - 77).stroke({ color: gold, alpha: 0.7, width: 2 });
    this.addChild(border);
  }
}
