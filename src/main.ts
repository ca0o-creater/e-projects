import { Application } from 'pixi.js';
import './style.css';
import { actOneConfig } from './config/act-one';
import { actOneIntroEnd } from './config/characters';
import { ActOneScene } from './scenes/act-one';
import { PointerInputAdapter } from './input/pointer-adapter';

const stage = document.querySelector<HTMLElement>('#stage')!;
const viewportSize = document.querySelector<HTMLDivElement>('#viewport-size')!;
const entrance = document.querySelector<HTMLElement>('#entrance')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const status = document.querySelector<HTMLParagraphElement>('#entrance-status')!;
const handoffStatus = document.querySelector<HTMLParagraphElement>('#handoff-status')!;
const assistButton = document.querySelector<HTMLButtonElement>('#assist-button')!;
const nextButton = document.querySelector<HTMLButtonElement>('#next-button')!;
const handoffUI = document.querySelector<HTMLDivElement>('#handoff-ui')!;
const mortalArrival = document.querySelector<HTMLElement>('#mortal-arrival')!;
const DESIGN_WIDTH = actOneConfig.stage.width;
const DESIGN_HEIGHT = actOneConfig.stage.height;
let app: Application | undefined;
let ready = false;
let entering = false;
let input: PointerInputAdapter | undefined;
let departed = false;
const params = new URLSearchParams(location.search);
const scenePreview = import.meta.env.DEV && params.get('preview') === 'act-one';
const time = params.get('time');
const previewTime = scenePreview && time !== null && Number.isFinite(Number(time)) ? Math.max(0, Number(time)) : null;

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
  const active = (scenePreview || document.fullscreenElement === document.documentElement) && ready;
  stage.hidden = !active;
  entrance.hidden = active;
  resize();
  if (!ready) return;
  if (active && !document.hidden && previewTime === null && !departed) {
    app?.start();
  } else {
    input?.cancel();
    app?.stop();
  }
}

resize();
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', syncFullscreen);
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
    background: actOneConfig.colors.background,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false,
  });

  const scene = new ActOneScene();
  if (previewTime !== null) scene.seek(previewTime);
  // 开发时跳过入场但继续播放，便于重复检查交接；正式构建不启用。
  if (scenePreview && params.get('skipIntro') === '1') scene.seek(actOneIntroEnd);
  app.stage.addChild(scene);
  app.ticker.add(scene.update);
  app.canvas.setAttribute('role', 'img');
  app.canvas.setAttribute('aria-label', '第一幕：后羿求药。后羿立于左侧山石旁，西王母从右上方云层降下，掌中药瓶发出微光。');
  stage.appendChild(app.canvas);
  const renderHandoffUI = (): void => {
    const handoff = scene.handoff;
    if (handoffStatus.textContent !== handoff.message) handoffStatus.textContent = handoff.message;
    assistButton.hidden = !['ready', 'dragging', 'snapped', 'returning'].includes(handoff.state);
    nextButton.hidden = handoff.state !== 'complete';
    stage.dataset.handoffState = handoff.state;
  };
  input = new PointerInputAdapter(app.canvas, scene.handoff.input, point => scene.handoff.canGrab(point));
  app.ticker.add(renderHandoffUI);
  assistButton.addEventListener('click', () => {
    input?.cancel();
    scene.handoff.assist();
    renderHandoffUI();
  });
  scene.on('handoff-complete', () => {
    // 此业务事件由状态机保证只派发一次，未来可在这里持久化地点解锁状态。
    window.dispatchEvent(new CustomEvent('mortal-unlocked', { detail: { sceneId: scene.sceneId } }));
    renderHandoffUI();
  });
  nextButton.addEventListener('click', () => {
    if (scene.handoff.state !== 'complete' || departed) return;
    departed = true;
    handoffUI.hidden = true;
    mortalArrival.hidden = false;
    window.dispatchEvent(new CustomEvent('navigate-to-mortal'));
    syncFullscreen();
  });
  window.addEventListener('pagehide', () => input?.dispose(), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => {
    input?.dispose();
    app?.destroy(true, { children: true });
  });
  renderHandoffUI();
  ready = true;
  enterButton.disabled = false;
  status.textContent = '';
  syncFullscreen();
  app.render();
}

main().catch((error: unknown) => {
  app?.ticker?.stop();
  status.textContent = '舞台初始化失败，请刷新页面或检查浏览器图形加速设置。';
  console.error(error);
});
