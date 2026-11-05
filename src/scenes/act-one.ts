import { BlurFilter, Container, FillGradient, Graphics, Rectangle, Text, type Ticker } from 'pixi.js';
import { actOneConfig as config } from '../config/act-one';

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

  constructor() {
    super();
    this.label = '第一幕 · 后羿得药';
    this.eventMode = 'none';
    this.drawPaper();
    this.drawMountains();
    this.drawClouds();
    this.drawTitle();
    this.drawFrame();
    this.seek(0);
  }

  readonly update = (ticker: Ticker): void => this.seek(this.elapsed + ticker.deltaMS / 1000);

  // 呼吸、云和题字共用播放时间；退出全屏时 ticker 停止，重新进入从原处继续。
  seek(seconds: number): void {
    this.elapsed = Math.max(0, seconds);
    this.cloudLayers.forEach((layer, index) => {
      layer.x = -((this.elapsed * config.clouds[index].speed) % width);
    });
    this.glow.alpha = config.light.alpha + config.light.breathAmplitude
      * Math.sin(this.elapsed * Math.PI * 2 / config.light.breathPeriod);
    const title = config.title;
    const t = this.elapsed - title.delay;
    const progress = t < 0 ? 0 : 1 - (1 - Math.min(t / title.enter, 1)) ** 3;
    const fade = Math.max(0, Math.min(1, (t - title.enter - title.hold) / title.exit));
    this.inscription.y = title.startY + (title.endY - title.startY) * progress;
    this.inscription.alpha = progress * (1 - fade);
    this.inscription.visible = this.inscription.alpha > 0;
    this.phase = t < 0 ? 'establishing' : t < title.enter ? 'title-enter'
      : t < title.enter + title.hold ? 'title-hold' : fade < 1 ? 'title-exit' : 'ambient';
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
