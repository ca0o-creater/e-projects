<<<<<<< Updated upstream
import { BlurFilter, Container, FillGradient, Graphics, NoiseFilter, Rectangle, Text, type Ticker } from 'pixi.js';
import { actOneConfig as config } from '../config/act-one';
import { charactersConfig as actors, actOneIntroEnd } from '../config/characters';
import { HouyiPuppet, QueenPuppet } from '../characters/puppets';
import { receivingHand } from '../characters/poses';
import { handoffConfig } from '../config/handoff';
import { HandoffController } from '../interaction/handoff';
import { rigConfig, armLengths } from '../config/rig.config';
import { solveArmIK, dampAngle } from '../characters/ik';
import { puppetLook } from '../config/puppet-look';
import { prologueConfig } from '../config/prologue.config';
import { prologueAt, houyiWalkAt, prologueBlackout, prologueFadeIn } from './prologue-timeline.ts';
import { createHouyiWalk } from '../characters/houyi-walk';

const { width, height } = config.stage;

// 细粒度动画相位：序章 → 第一幕开场/题字 → 人物入场 → 赐药。
// 对外状态由 sceneState 提供：prologue → scene1_intro → scene1_interaction → scene1_ending → scene1_complete。
export type ActOnePhase = 'prologue' | 'establishing' | 'title-enter' | 'title-hold' | 'title-exit' | 'characters-enter' | 'awaiting-elixir';

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

=======
import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import { actOneConfig as config } from '../config/act-one';
import { cloudOffset, sampleTitle, type ActOnePhase } from './act-one-timeline';

/** 第一幕：云山布景与入场题字。后续角色可以放入独立的表演层。 */
>>>>>>> Stashed changes
export class ActOneScene extends Container {
  readonly sceneId = 'houyi-gets-elixir';
  phase: ActOnePhase = 'establishing';
  private elapsed = 0;
<<<<<<< Updated upstream
  private prologueTime = 0;
  private prologueIndex = -1;
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
  private readonly rodLayer = new Container({label:'幕后操纵杆'});
  private readonly rods = [this.makeRodPair(),this.makeRodPair()];
  // 序章层压在最上面：山门剪影、行走的后羿、旁白与托底；第一幕骨架在序章里全部隐藏。
  private readonly prologueLayer = new Container({ label: '序章 · 山门与旁白' });
  private readonly walk = createHouyiWalk();
  private readonly gate = new Graphics();
  private readonly prologueBackdrop = new Graphics();
  private readonly blackout = new Graphics();
  private fadeFromBlack = false;
  private readonly prologueText = new Text({ text: '', style: {
    fontFamily: [...prologueConfig.subtitle.fontFamily],
    fontSize: prologueConfig.subtitle.fontSize,
    fill: prologueConfig.colors.text,
    align: 'center',
    lineHeight: prologueConfig.subtitle.lineHeight,
    letterSpacing: prologueConfig.subtitle.letterSpacing,
    wordWrap: true,
    wordWrapWidth: prologueConfig.subtitle.maxWidth,
    breakWords: true,
    dropShadow: {
      color: prologueConfig.colors.shadow,
      alpha: prologueConfig.subtitle.shadow.alpha,
      blur: prologueConfig.subtitle.shadow.blur,
      distance: prologueConfig.subtitle.shadow.distance,
      angle: prologueConfig.subtitle.shadow.angle,
    },
  } });

  private makeRodPair() {
    const group=new Container(),shadow=new Graphics(),ink=new Graphics();
    shadow.position.set(actors.shadow.x,actors.shadow.y);
    shadow.alpha=actors.shadow.alpha;
    shadow.filters=[new BlurFilter({strength:3,quality:3})];
    ink.blendMode='multiply';group.addChild(shadow,ink);
    return {group,shadow,ink};
  }

  private updateRods():void {
    const c=puppetLook.rods;
    const sources=[
      {puppet:this.houyi, settings:c.houyi, hand:this.houyi.rig.handNode},
      {puppet:this.queen, settings:c.queen, hand:this.queen.rig.arm},
    ];
    sources.forEach(({puppet,settings,hand},index)=>{
      const pair=this.rods[index];pair.group.alpha=puppet.alpha;
      const torso=this.toLocal(puppet.toGlobal(settings.torso));
      const wrist=this.toLocal(hand.toGlobal({x:0,y:0}));
      pair.ink.clear();pair.shadow.clear();
      for(const [point,footX] of [[torso,settings.bodyFootX],[wrist,settings.handFootX]] as const) {
        pair.shadow.moveTo(footX,c.bottomY).lineTo(point.x,point.y).stroke({color:actors.shadow.color,width:c.width+1});
        pair.ink.moveTo(footX,c.bottomY).lineTo(point.x,point.y).stroke({color:c.color,width:c.width});
        pair.ink.moveTo(footX-0.6,c.bottomY).lineTo(point.x-0.6,point.y).stroke({color:c.highlight,width:0.8,alpha:0.6});
      }
    });
  }
=======
  private readonly cloudLayers: Container[] = [];
  private readonly inscription = new Container();
>>>>>>> Stashed changes

  constructor() {
    super();
    this.label = '第一幕 · 后羿得药';
    this.eventMode = 'none';
<<<<<<< Updated upstream
    this.drawPaper();
    this.drawMountains();
    this.drawClouds();
    this.rodLayer.addChild(...this.rods.map(pair=>pair.group));
    this.addChild(this.rodLayer);
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
    this.drawPrologue();
    this.seek(0);
    this.enterPrologue();
    this.filterArea=new Rectangle(0,0,width,height);
    this.filters=[new NoiseFilter({...config.grain})];
  }

  readonly update = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    if (this.phase === 'prologue') {
      // 序章期间只推进旁白时间：不推进接药状态机，handoff 始终停在 intro，无法抓取。
      const next = this.prologueTime + dt;
      if (next >= prologueConfig.total) this.finishPrologue();
      else this.renderPrologue(next);
      return;
    }
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
    if(this.detached && this.handoff.state==='ready') {
      // 等待抓取时药瓶继续跟随西王母悬浮，抓取后才固定本次曲线路径。
      this.handoff.setPath(this.toLocal(this.queen.palm.toGlobal({x:0,y:-actors.bottle.radius})));
    }
    let pose: {shoulder:number;elbow:number} = rigConfig.houyi.rest;
    const tracking = ['dragging','snapped'].includes(this.handoff.state)
      || (this.handoff.state === 'completing' && this.handoff.completionProgress === 0);
    if (tracking) {
      const target = this.handoff.point, bounds = rigConfig.targetBounds;
      const x = Math.max(bounds.minX,Math.min(bounds.maxX,target.x));
      const y = Math.max(bounds.minY,Math.min(bounds.maxY,target.y+actors.bottle.radius));
      const solution = solveArmIK(actors.houyi.shoulder,
        {x:(x-this.houyi.x)/this.houyi.scale.x,y:(y-this.houyi.y)/this.houyi.scale.y},armLengths.upper,armLengths.lower);
      if(solution) pose=solution;
    }
    const limits=rigConfig.houyi.limits;
    const seconds=tracking ? rigConfig.houyi.followSeconds : rigConfig.resetSeconds;
    const current=this.houyi.rig;
    this.houyi.setArmPose(
      dampAngle(current.shoulderNode.rotation,Math.max(limits.shoulder[0],Math.min(limits.shoulder[1],pose.shoulder)),dt,seconds),
      dampAngle(current.elbowNode.rotation,Math.max(limits.elbow[0],Math.min(limits.elbow[1],pose.elbow)),dt,seconds));
    const completing = this.handoff.state === 'completing' || this.handoff.state === 'complete';
    if (this.detached) {
      const point = completing && this.handoff.completionProgress > 0
        ? this.toLocal(this.houyi.rig.handNode.toGlobal({ x:0, y:0 })) : this.handoff.point;
      if(completing && this.handoff.completionProgress > 0) point.y-=actors.bottle.radius;
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
    this.updateRods();
  }

  // 题字与人物按第一幕自己的时间播放；云、暖光与后羿呼吸由 updateAmbient 用连续时钟推进。
  // 退出全屏时 ticker 停止，重新进入从原处继续。
  seek(seconds: number): void {
    this.exitPrologue();
    this.elapsed = Math.max(0, seconds);
    const title = config.title;
    const clamp = (t: number) => Math.max(0, Math.min(1, t));
    // 后羿从序章起就在台上；appearAt/fadeDuration 为 0 时不再淡入，避免切幕时消失或瞬移。
    const houyiProgress = actors.houyi.fadeDuration > 0
      ? clamp((this.elapsed - actors.houyi.appearAt) / actors.houyi.fadeDuration) : 1;
    this.houyi.alpha = houyiProgress;
    const queenProgress = clamp((this.elapsed - actors.queen.appearAt) / actors.queen.enterDuration);
    this.queen.alpha = queenProgress;
    this.queen.y = actors.queen.startY + (actors.queen.y - actors.queen.startY) * (1 - (1 - queenProgress) ** 3);
    const arrival = actors.queen.appearAt + actors.queen.enterDuration;
    const glowTime = Math.max(0, this.elapsed - arrival);
    this.queen.y+=Math.sin(glowTime*Math.PI*2/rigConfig.queen.floatPeriod)*rigConfig.queen.floatAmplitude;
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
    // 从序章切过来时先保持全黑，再在 0.5 秒内亮起，避免硬切。
    if (this.fadeFromBlack) {
      this.blackout.alpha = prologueFadeIn(this.elapsed);
      if (this.elapsed >= prologueConfig.transition.fadeFromBlack) this.fadeFromBlack = false;
    } else {
      this.blackout.alpha = 0;
    }
    this.updateAmbient();
    this.updateRods();
  }

  // 云、暖光和后羿呼吸共用一条连续时钟：序章（含暗场）与第一幕时间首尾相接。
  private get stageTime(): number {
    return this.phase === 'prologue' ? this.prologueTime : prologueConfig.total + this.elapsed;
  }

  private updateAmbient(): void {
    const t = this.stageTime;
    this.cloudLayers.forEach((layer, index) => {
      layer.x = -((t * config.clouds[index].speed) % width);
    });
    this.glow.alpha = config.light.alpha + config.light.breathAmplitude
      * Math.sin(t * Math.PI * 2 / config.light.breathPeriod);
    const breath = prologueConfig.houyi.breath;
    this.houyi.y = actors.houyi.y + Math.sin(t * Math.PI * 2 / breath.period) * breath.amplitude;
  }

  // 序章与第一幕的衔接：点击“跳过序章”或旁白播完都走 finishPrologue。
  skipPrologue(): void {
    if (this.phase === 'prologue') this.finishPrologue();
  }

  // 开发静帧：把序章冻结在指定秒数；超出总时长则直接进入第一幕。
  seekPrologue(seconds: number): void {
    if (seconds >= prologueConfig.total) { this.seek(0); return; }
    this.phase = 'prologue';
    this.prologueIndex = -1;
    this.prologueLayer.visible = true;
    this.renderPrologue(Math.max(0, seconds));
  }

  // 供 DOM 按钮显示/隐藏；暗场开始后不再显示。
  get showSkipButton(): boolean {
    return this.phase === 'prologue' && this.prologueTime < prologueConfig.duration
      && this.prologueTime >= prologueConfig.skip.appearAt;
  }

  // 对外状态名与第二幕的 scene2_* 对齐，便于样式和自动化检查读取。
  get sceneState(): string {
    if (this.phase === 'prologue') return 'prologue';
    if (this.handoff.state === 'intro') return 'scene1_intro';
    if (this.handoff.state === 'complete') return 'scene1_complete';
    return this.handoff.state === 'completing' ? 'scene1_ending' : 'scene1_interaction';
  }

  private enterPrologue(): void {
    this.phase = 'prologue';
    this.prologueTime = 0;
    this.prologueIndex = -1;
    this.prologueLayer.visible = true;
    this.renderPrologue(0);
  }

  // 旁白与暗场都结束：带着全黑遮罩进入第一幕，随后由 seek 在 0.5 秒内亮起。
  private finishPrologue(): void {
    this.fadeFromBlack = true;
    this.seek(0);
  }

  private exitPrologue(): void {
    if (this.phase !== 'prologue') return;
    this.prologueTime = prologueConfig.total;
    this.prologueLayer.visible = false;
    this.prologueText.alpha = 0;
  }

  private renderPrologue(seconds: number): void {
    const frame = prologueAt(seconds);
    this.prologueTime = seconds;
    this.prologueBackdrop.alpha = frame.backdropAlpha;
    if (frame.index !== this.prologueIndex) {
      this.prologueIndex = frame.index;
      this.prologueText.text = frame.text;
    }
    this.prologueText.alpha = frame.alpha;
    // 行走：旁白期间从画外左下角走向山门，同时缩小、变淡并带轻微起伏。
    const walk = houyiWalkAt(seconds);
    this.walk.position.set(walk.x, walk.y);
    this.walk.scale.set(walk.scale);
    this.walk.alpha = walk.alpha;
    // 第一幕的人物骨架在序章里完全隐藏，切幕后由暗场遮住替换过程。
    this.houyi.alpha = 0;
    this.blackout.alpha = prologueBlackout(seconds);
    this.updateAmbient();
    this.updateRods();
  }

  private drawPrologue(): void {
    const c = prologueConfig, b = c.subtitle.backdrop;
    const withAlpha = (alpha: number) =>
      `${c.colors.backdrop}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0')}`;
    const backdrop = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 },
      outerRadius: 0.5, textureSize: 256,
      colorStops: [
        { offset: 0, color: withAlpha(b.alpha) },
        { offset: b.falloff, color: withAlpha(b.alpha * 0.55) },
        { offset: 1, color: withAlpha(0) },
      ] });
    this.prologueBackdrop.ellipse(c.subtitle.x, c.subtitle.y, b.width / 2, b.height / 2).fill(backdrop);
    this.drawGate();
    this.prologueText.anchor.set(0.5);
    this.prologueText.position.set(c.subtitle.x, c.subtitle.y);
    this.prologueText.alpha = 0;
    // 由远及近：山门在下、行走的后羿在中、旁白托底与文字在上。
    this.prologueLayer.addChild(this.gate, this.walk, this.prologueBackdrop, this.prologueText);
    this.addChild(this.prologueLayer);
    // 暗场层始终压在最上面，切换第一幕时先全黑再亮起。
    this.blackout.rect(0, 0, width, height).fill('#000000');
    this.blackout.alpha = 0;
    this.addChild(this.blackout);
  }

  // 山门剪影：屋顶、匾额、横梁与两根立柱，门洞留空让人物站进去。
  private drawGate(): void {
    const g = this.gate, c = prologueConfig.gate;
    const k = c.width / 360, h = c.height, paint = { color: c.color, alpha: c.alpha };
    g.position.set(c.x, c.baseY);
    // 地面阴影：让远处的山门有落地感，不再是悬空的剪影。
    const shadow = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 },
      outerRadius: 0.5, textureSize: 128,
      colorStops: [{ offset: 0, color: `${c.color}44` }, { offset: 1, color: `${c.color}00` }] });
    g.ellipse(0, 4, 250 * k, 22).fill(shadow);
    // 屋顶：两端上翘的瓦檐
    g.moveTo(-205 * k, -h + 78 * k)
      .quadraticCurveTo(-150 * k, -h + 30 * k, -70 * k, -h + 12 * k)
      .quadraticCurveTo(0, -h - 4 * k, 70 * k, -h + 12 * k)
      .quadraticCurveTo(150 * k, -h + 30 * k, 205 * k, -h + 78 * k)
      .lineTo(150 * k, -h + 56 * k)
      .quadraticCurveTo(0, -h + 44 * k, -150 * k, -h + 56 * k)
      .closePath().fill(paint);
    g.rect(-176 * k, -h + 78 * k, 352 * k, 14 * k).fill(paint);
    g.roundRect(-72 * k, -h + 106 * k, 144 * k, 44 * k, 8 * k).fill(paint);
    g.rect(-190 * k, -h + 162 * k, 380 * k, 18 * k).fill(paint);
    g.rect(-168 * k, -h + 172 * k, 52 * k, h - 172 * k).fill(paint);
    g.rect(116 * k, -h + 172 * k, 52 * k, h - 172 * k).fill(paint);
    g.rect(-210 * k, -10, 420 * k, 10).fill(paint);
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
      bank.pivot.y = height;
      bank.y = height;
      bank.scale.y = config.mountains.heightScale;
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
=======
    this.drawBackdrop();
    this.drawMountains(true);
    this.drawClouds();
    this.drawMountains(false);
    this.drawInscription();
    this.drawFrame();
    this.applyTimeline();
  }

  // 和 Application 共用 ticker，退出全屏停止 ticker 后，云与题字都停在原处。
  readonly update = (ticker: Ticker): void => {
    this.seek(this.elapsed + ticker.deltaMS / 1000);
  };

  /** 支持本地美术预览定位时间；常规播放由 ticker 调用。 */
  seek(seconds: number): void {
    this.elapsed = Math.max(0, seconds);
    this.cloudLayers.forEach((layer, index) => {
      layer.x = cloudOffset(this.elapsed, config.clouds[index].speed, config.stage.width);
    });
    this.applyTimeline();
  }

  private applyTimeline(): void {
    const state = sampleTitle(this.elapsed, config.title);
    this.phase = state.phase;
    this.inscription.y = config.title.startY
      + (config.title.endY - config.title.startY) * state.progress;
    this.inscription.alpha = state.alpha;
    this.inscription.visible = state.alpha > 0;
  }

  private drawBackdrop(): void {
    const { width, height } = config.stage;
    const backdrop = new Graphics().rect(0, 0, width, height).fill(config.colors.background);
    // 叠加低透明度椭圆，模拟幕布后方的暖色灯光。
    for (let i = 0; i < 18; i++) {
      backdrop.ellipse(width / 2, height * 0.46, 1100 - i * 35, 760 - i * 23)
        .fill({ color: config.colors.lamplight, alpha: 0.025 });
    }
    // 稀疏经纬纹只绘制一次，不在每帧重建 Graphics。
    for (let y = 0; y < height; y += 6) {
      backdrop.moveTo(0, y).lineTo(width, y).stroke({ color: config.colors.curtain, alpha: 0.045, width: 1 });
    }
    this.addChild(backdrop);
  }

  private drawClouds(): void {
    for (const settings of config.clouds) {
      const layer = new Container();
      layer.label = `云层 ${settings.speed} px/s`;
      // 相同图案首尾拼接；每次循环只重置父容器位置，没有云朵突然出现。
      for (const tile of [-1, 0, 1, 2]) {
        for (let i = 0; i < 3; i++) {
          const cloud = new Graphics()
            .ellipse(0, 18, 150, 24)
            .ellipse(-73, 0, 65, 34)
            .ellipse(-5, -20, 70, 48)
            .ellipse(68, 0, 64, 32)
            .fill(settings.color);
          cloud.moveTo(-111, 10).bezierCurveTo(-65, -6, -48, 24, -8, 8)
            .bezierCurveTo(20, -7, 62, -1, 105, 14)
            .stroke({ color: settings.color, alpha: 0.6, width: 2 });
          cloud.position.set(tile * config.stage.width + i * 640 + 170, settings.y + (i % 2) * 96);
          cloud.scale.set(settings.scale * (i === 1 ? 0.78 : 1), settings.scale);
          cloud.alpha = settings.alpha;
          layer.addChild(cloud);
        }
      }
      this.cloudLayers.push(layer);
      this.addChild(layer);
    }
  }

  private drawMountains(distant: boolean): void {
    const { width, height } = config.stage;
    const mountains = new Graphics();
    if (distant) {
      mountains.moveTo(0, 825).lineTo(130, 730).lineTo(215, 752).lineTo(365, 540)
        .lineTo(430, 620).lineTo(505, 580).lineTo(690, 815).lineTo(910, 735)
        .lineTo(1060, 830).lineTo(1280, 610).lineTo(1355, 660).lineTo(1490, 480)
        .lineTo(1590, 630).lineTo(1685, 590).lineTo(1850, 780).lineTo(width, 750)
        .lineTo(width, height).lineTo(0, height).closePath()
        .fill({ color: config.colors.distantMountain, alpha: 0.7 });
    } else {
      mountains.moveTo(0, 930).lineTo(135, 860).lineTo(250, 900).lineTo(375, 750)
        .lineTo(455, 800).lineTo(535, 730).lineTo(735, 943).lineTo(950, 910)
        .lineTo(1070, 950).lineTo(1290, 850).lineTo(1420, 920).lineTo(1610, 730)
        .lineTo(1700, 825).lineTo(1790, 790).lineTo(width, 910)
        .lineTo(width, height).lineTo(0, height).closePath().fill(config.colors.mountain);
      mountains.moveTo(0, 1015).quadraticCurveTo(450, 945, 930, 1015)
        .quadraticCurveTo(1450, 955, width, 1005).lineTo(width, height)
        .lineTo(0, height).closePath().fill(config.colors.ground);
    }
    this.addChild(mountains);
  }

  private drawInscription(): void {
    const { colors, title, stage } = config;
    this.inscription.x = stage.width / 2;
    const ornament = new Graphics()
      .moveTo(-385, -69).lineTo(-48, -69).moveTo(48, -69).lineTo(385, -69)
      .stroke({ color: colors.gold, width: 2, alpha: 0.85 })
      .poly([0, -81, 12, -69, 0, -57, -12, -69]).fill(colors.gold)
      .moveTo(-260, 74).lineTo(260, 74).stroke({ color: colors.gold, width: 2 });
    const text = new Text({
      text: title.text,
      style: {
        fontFamily: [...title.fontFamily], fontSize: title.fontSize,
        fill: colors.title, letterSpacing: 8,
        dropShadow: { color: colors.titleShadow, alpha: 0.7, blur: 3, distance: 4, angle: Math.PI / 2 },
      },
    });
    text.anchor.set(0.5);
    const seal = new Graphics().roundRect(-24, 95, 48, 48, 3).fill(colors.seal)
      .roundRect(-20, 99, 40, 40, 2).stroke({ color: colors.gold, width: 1 });
    const sealText = new Text({ text: '壹', style: { fontFamily: [...title.fontFamily], fontSize: 30, fill: colors.title } });
    sealText.anchor.set(0.5);
    sealText.y = 119;
    this.inscription.addChild(ornament, text, seal, sealText);
>>>>>>> Stashed changes
    this.addChild(this.inscription);
  }

  private drawFrame(): void {
<<<<<<< Updated upstream
    const { frame, gold } = config.colors;
    const border = new Graphics().rect(0, 0, width, 30).rect(0, height - 25, width, 25)
      .rect(0, 0, 28, height).rect(width - 28, 0, 28, height).fill(frame)
      .rect(38, 40, width - 76, height - 77).stroke({ color: gold, alpha: 0.7, width: 2 });
=======
    const { width, height } = config.stage;
    const { frame, gold } = config.colors;
    const border = new Graphics().rect(0, 0, width, 44).rect(0, height - 30, width, 30)
      .rect(0, 0, 40, height).rect(width - 40, 0, 40, height).fill(frame)
      .rect(50, 54, width - 100, height - 96).stroke({ color: gold, alpha: 0.65, width: 2 });
    // 上沿垂下的小弧边，像皮影戏台的幕帘。
    for (let x = 40; x < width - 40; x += 115) {
      border.moveTo(x, 42).quadraticCurveTo(x + 57.5, 102, x + 115, 42)
        .closePath().fill(frame)
        .moveTo(x + 8, 46).quadraticCurveTo(x + 57.5, 85, x + 107, 46)
        .stroke({ color: gold, alpha: 0.5, width: 2 });
    }
>>>>>>> Stashed changes
    this.addChild(border);
  }
}
