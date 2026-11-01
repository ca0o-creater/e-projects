import { Application, Text } from 'pixi.js';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const viewportSize = document.querySelector<HTMLDivElement>('#viewport-size')!;
const entrance = document.querySelector<HTMLElement>('#entrance')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const status = document.querySelector<HTMLParagraphElement>('#entrance-status')!;
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
let app: Application | undefined;
let ready = false;
let entering = false;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  viewportSize.textContent = `浏览器宽度：${width}px · 高度：${height}px`;
  // 只缩放显示尺寸，PixiJS 内部坐标始终保持 1920 × 1080。
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  stage.style.width = `${DESIGN_WIDTH * scale}px`;
  stage.style.height = `${DESIGN_HEIGHT * scale}px`;
}

function syncFullscreen(): void {
  const active = document.fullscreenElement === document.documentElement && ready;
  stage.hidden = !active;
  entrance.hidden = active;
  resize();
  if (active) {
    app?.start();
  } else {
    app?.stop();
  }
}

resize();
window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', () => {
  syncFullscreen();
  if (!document.fullscreenElement && ready) {
    status.textContent = '';
    enterButton.focus({ preventScroll: true });
  }
});

enterButton.addEventListener('click', async () => {
  if (!ready || entering) return;
  if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
    status.textContent = '当前浏览器无法进入全屏，请使用支持全屏的浏览器打开此页面。';
    return;
  }
  entering = true;
  enterButton.disabled = true;
  status.textContent = '';
  try {
    // 在点击处理函数内直接发起请求，保留浏览器要求的用户激活状态。
    await document.documentElement.requestFullscreen();
    syncFullscreen();
  } catch (error: unknown) {
    syncFullscreen();
    status.textContent = '未能进入全屏，请允许全屏后再次点击“进入体验”。';
    console.error(error);
  } finally {
    entering = false;
    enterButton.disabled = false;
  }
});

async function main(): Promise<void> {
  app = new Application();
  await app.init({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: '#352218',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false,
  });

  const title = new Text({
    text: '嫦娥奔月 · 舞台测试',
    style: {
      fontFamily: ['Microsoft YaHei', 'PingFang SC', 'sans-serif'],
      fontSize: 48,
      fill: '#ffffff',
    },
  });
  title.anchor.set(0.5);
  title.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(title);
  app.canvas.setAttribute('role', 'img');
  app.canvas.setAttribute('aria-label', '嫦娥奔月 · 舞台测试');
  stage.appendChild(app.canvas);
  ready = true;
  enterButton.disabled = false;
  status.textContent = '';
  syncFullscreen();
}

main().catch((error: unknown) => {
  app?.stop();
  status.textContent = '舞台初始化失败，请刷新页面或检查浏览器图形加速设置。';
  console.error(error);
});
