import { Application } from 'pixi.js';
import './style.css';
import { actOneConfig } from './config/act-one';
import { actOneIntroEnd } from './config/characters';
import { ActOneScene } from './scenes/act-one';
import { loadRigAssets } from './characters/image-rigs';
import { PointerInputAdapter } from './input/pointer-adapter';
import { ActTwoScene } from './scenes/act-two';
import { actTwoConfig } from './config/act-two';
import { destroyScene, SceneLifetime } from './scenes/scene-lifetime';

const stage = document.querySelector<HTMLElement>('#stage')!;
const viewportSize = document.querySelector<HTMLDivElement>('#viewport-size')!;
const entrance = document.querySelector<HTMLElement>('#entrance')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const status = document.querySelector<HTMLParagraphElement>('#entrance-status')!;
const handoffStatus = document.querySelector<HTMLParagraphElement>('#handoff-status')!;
const assistButton = document.querySelector<HTMLButtonElement>('#assist-button')!;
const nextButton = document.querySelector<HTMLButtonElement>('#next-button')!;
const DESIGN_WIDTH = actOneConfig.stage.width;
const DESIGN_HEIGHT = actOneConfig.stage.height;
let app: Application | undefined;
let ready = false;
let entering = false;
let input: PointerInputAdapter | undefined;
let currentScene: ActOneScene | ActTwoScene | undefined;
let lifetime = new SceneLifetime();
const events = new AbortController();
const eventOptions = { signal: events.signal };
const params = new URLSearchParams(location.search);
const previewScene = params.get('preview');
const scenePreview = import.meta.env.DEV && ['act-one','act-two'].includes(previewScene ?? '');
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
  if (active && !document.hidden && previewTime === null) {
    app?.start();
  } else {
    input?.cancel();
    app?.stop();
  }
}

resize();
window.addEventListener('resize', resize, eventOptions);
document.addEventListener('visibilitychange', syncFullscreen, eventOptions);
document.addEventListener('fullscreenchange', () => {
  syncFullscreen();
  if (!document.fullscreenElement && ready) {
    status.textContent = '';
    enterButton.focus({ preventScroll: true });
  }
}, eventOptions);

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
}, eventOptions);

function renderSceneUI():void {
  const scene=currentScene;
  if(!scene) return;
  const controller=scene instanceof ActOneScene ? scene.handoff:scene.swallow;
  if(handoffStatus.textContent!==controller.message) handoffStatus.textContent=controller.message;
  assistButton.hidden=!(scene instanceof ActOneScene && ['ready','dragging','snapped','returning'].includes(controller.state));
  nextButton.hidden=!(scene instanceof ActOneScene && controller.state==='complete');
  stage.dataset.scene=scene instanceof ActOneScene?'act-one':'act-two';
  stage.dataset.sceneState=scene instanceof ActTwoScene?scene.sceneState:'scene1';
  stage.dataset.interactionState=controller.state;
  stage.dataset.handoffState=scene instanceof ActOneScene?controller.state:'';
}

function mountScene(scene:ActOneScene|ActTwoScene):void {
  if(!app) return;
  lifetime.dispose(); // 输入取消、ticker 注销、声音/计时清理、显示树销毁均先于新幕挂载。
  lifetime=new SceneLifetime();
  currentScene=scene;
  app.stage.addChild(scene);
  lifetime.add(()=>destroyScene(scene));
  if(scene instanceof ActTwoScene) lifetime.add(()=>scene.dispose());
  app.ticker.add(scene.update);
  const ticker=app.ticker;
  lifetime.add(()=>ticker.remove(scene.update));
  const controller=scene instanceof ActOneScene?scene.handoff:scene.swallow;
  input=new PointerInputAdapter(app.canvas,controller.input,point=>controller.canGrab(point));
  const adapter=input;
  lifetime.add(()=>adapter.dispose());
  // 两幕动画全部由 ticker 驱动，无 setTimeout/setInterval 或音轨。
  // 后续音轨、独立计时器必须登记 lifetime.audio / timeout / interval。
  if(scene instanceof ActOneScene) {
    scene.once('handoff-complete',()=>{
      window.dispatchEvent(new CustomEvent('mortal-unlocked',{detail:{sceneId:scene.sceneId}}));
      renderSceneUI();
    });
  } else {
    scene.once('moon-unlocked',()=>{
      window.dispatchEvent(new CustomEvent('moon-unlocked',{detail:{sceneId:scene.sceneId}}));
      renderSceneUI();
    });
  }
  const label=scene instanceof ActOneScene?'第一幕 · 后羿得药':'第二幕 · 凡间：嫦娥吞药';
  stage.setAttribute('aria-label',label);
  app.canvas.setAttribute('aria-label',label);
  renderSceneUI();
}

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

  const directActTwo=scenePreview && previewScene==='act-two';
  if(!directActTwo) await loadRigAssets();
  const scene = directActTwo?new ActTwoScene():new ActOneScene();
  if (previewTime !== null) scene.seek(previewTime);
  // 开发时跳过入场但继续播放，便于重复检查交接；正式构建不启用。
  if (scenePreview && params.get('skipIntro') === '1') scene.seek(directActTwo?actTwoConfig.intro.duration:actOneIntroEnd);
  app.canvas.setAttribute('role', 'img');
  stage.appendChild(app.canvas);
  mountScene(scene);
  app.ticker.add(renderSceneUI);
  assistButton.addEventListener('click', () => {
    input?.cancel();
    if(currentScene instanceof ActOneScene) currentScene.handoff.assist();
    renderSceneUI();
  }, eventOptions);
  nextButton.addEventListener('click', () => {
    if (!(currentScene instanceof ActOneScene) || currentScene.handoff.state !== 'complete') return;
    // 先释放第一幕，再构建第二幕，避免遗留场景/输入与第二幕同时存在。
    lifetime.dispose();currentScene=undefined;input=undefined;
    mountScene(new ActTwoScene());
    window.dispatchEvent(new CustomEvent('navigate-to-mortal'));
    syncFullscreen();
  }, eventOptions);
  window.addEventListener('pagehide', () => {app?.stop();lifetime.dispose();currentScene=undefined;}, { once: true, signal: events.signal });
  if (import.meta.hot) import.meta.hot.dispose(() => {
    events.abort();
    lifetime.dispose();
    app?.destroy(true, { children: true });
  });
  renderSceneUI();
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
