import {ActThreeScene} from './scenes/act-three';
import {scene3Config} from './config/scene3.config';
import {HoldButtonAdapter} from './input/hold-button';
import {EndingFilm} from './ending-film';
import { Application } from 'pixi.js';
import './style.css';
import { actOneConfig } from './config/act-one';
import { actOneIntroEnd } from './config/characters';
import { ActOneScene } from './scenes/act-one';
import { loadRigAssets } from './characters/image-rigs';
import { SceneInputAdapter } from './input/act-one-input';
import { captureSwallowTarget, captureAscentTarget } from './input/scene-targets';
import { captureHandoffTarget } from './input/handoff-target';
import { receivingHand } from './characters/poses';
import { ActTwoScene } from './scenes/act-two';
import { actTwoConfig } from './config/act-two';
import { loadActTwoAssets } from './characters/fengmeng';
import {Assets} from 'pixi.js';
import { destroyScene, SceneLifetime } from './scenes/scene-lifetime';

const stage = document.querySelector<HTMLElement>('#stage')!;
const viewportSize = document.querySelector<HTMLDivElement>('#viewport-size')!;
const entrance = document.querySelector<HTMLElement>('#entrance')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const status = document.querySelector<HTMLParagraphElement>('#entrance-status')!;
const handoffStatus = document.querySelector<HTMLParagraphElement>('#handoff-status')!;
const assistButton = document.querySelector<HTMLButtonElement>('#assist-button')!;
const nextButton = document.querySelector<HTMLButtonElement>('#next-button')!;
const ascentAssist=document.querySelector<HTMLButtonElement>('#ascent-assist')!;
const replayButton=document.querySelector<HTMLButtonElement>('#replay-button')!;
const reviewButton=document.querySelector<HTMLButtonElement>('#review-button')!;
const reviewPanel=document.querySelector<HTMLElement>('#review-panel')!;
let assistInput:HoldButtonAdapter|undefined;
let endingFilm:EndingFilm|undefined;
const DESIGN_WIDTH = actOneConfig.stage.width;
const DESIGN_HEIGHT = actOneConfig.stage.height;
let app: Application | undefined;
let ready = false;
let entering = false;
let input: SceneInputAdapter | undefined;
let currentScene: ActOneScene | ActTwoScene | ActThreeScene | undefined;
let lifetime = new SceneLifetime();
const events = new AbortController();
const eventOptions = { signal: events.signal };
const params = new URLSearchParams(location.search);
const previewScene = params.get('preview');
const scenePreview = import.meta.env.DEV && ['act-one','act-two','act-three'].includes(previewScene ?? '');
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
  if (active && !document.hidden && previewTime === null && !['video','ending'].includes(endingFilm?.phase??'')) {
    app?.start();
  } else {
    input?.cancel();
    assistInput?.cancel();
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
  const controller=scene instanceof ActOneScene ? scene.handoff:scene instanceof ActTwoScene?scene.swallow:scene.ascent;
  const message=scene instanceof ActTwoScene?scene.transitionMessage:controller.message;
  if(handoffStatus.textContent!==message) handoffStatus.textContent=message;
  assistButton.hidden=!(scene instanceof ActOneScene && ['ready','dragging','snapped','returning'].includes(controller.state));
  nextButton.hidden=!(scene instanceof ActOneScene && controller.state==='complete');
  ascentAssist.hidden=!(scene instanceof ActThreeScene && ['ready','dragging','armed'].includes(controller.state));
  replayButton.hidden=reviewButton.hidden=true; // 第三幕的结尾按钮由 DOM 电影流程管理。
  stage.dataset.scene=scene instanceof ActOneScene?'act-one':scene instanceof ActTwoScene?'act-two':'act-three';
  stage.dataset.sceneState=scene instanceof ActOneScene?'scene1':scene.sceneState;
  stage.dataset.interactionState=controller.state;
  stage.dataset.handoffState=scene instanceof ActOneScene?controller.state:'';
  if(scene instanceof ActThreeScene){
    if(controller.state==='ending'||controller.state==='complete')handoffStatus.textContent='';
    if(controller.state==='complete')endingFilm?.start();
    if(endingFilm?.phase==='ending')stage.dataset.sceneState='ending';
  }
}

function mountScene(scene:ActOneScene|ActTwoScene|ActThreeScene):void {
  if(!app) return;
  lifetime.dispose(); // 输入取消、ticker 注销、声音/计时清理、显示树销毁均先于新幕挂载。
  lifetime=new SceneLifetime();
  currentScene=scene;reviewPanel.hidden=true;assistInput=undefined;endingFilm=undefined;
  if(scene instanceof ActOneScene)document.querySelector('#handoff-ui')!.append(nextButton);
  else nextButton.remove(); // 第二、三幕 DOM 中不保留旧转场按钮。
  app.stage.addChild(scene);
  lifetime.add(()=>destroyScene(scene));
  if(!(scene instanceof ActOneScene)) lifetime.add(()=>scene.dispose());
  app.ticker.add(scene.update);
  const ticker=app.ticker;
  lifetime.add(()=>ticker.remove(scene.update));
  const controller=scene instanceof ActOneScene?scene.handoff:scene instanceof ActTwoScene?scene.swallow:scene.ascent;
  const captureTarget=()=>scene instanceof ActOneScene
    ?scene.handoff.state==='ready'?captureHandoffTarget(scene.handoff.point,receivingHand(1)):null
    :scene instanceof ActTwoScene?captureSwallowTarget(scene.swallow):captureAscentTarget(scene.ascent);
  if(!input)input=new SceneInputAdapter(stage,app.canvas,controller.input,point=>controller.canGrab(point),captureTarget);
  else input.bind(controller.input,point=>controller.canGrab(point),captureTarget);
  const adapter=input;
  lifetime.add(()=>adapter.unbind()); // 先取消旧幕捕获，再销毁人物；保留全局摄像头和模式。
  if(scene instanceof ActThreeScene){
    const film=new EndingFilm(()=>{stage.dataset.sceneState='ending';input?.dispose();input=undefined;assistInput?.dispose();app?.stop();},
      ()=>{lifetime.dispose();currentScene=undefined;input=undefined;mountScene(new ActOneScene());syncFullscreen();},
      ()=>{input?.dispose();input=undefined;assistInput?.dispose();app?.stop();});
    endingFilm=film;lifetime.add(()=>film.dispose());
    const hold=new HoldButtonAdapter(ascentAssist,()=>{adapter.reset();return scene.ascent.startAssist();},()=>scene.ascent.cancel());
    assistInput=hold;lifetime.add(()=>hold.dispose());
  }
  // 两幕动画全部由 ticker 驱动，无 setTimeout/setInterval 或音轨。
  // 后续音轨、独立计时器必须登记 lifetime.audio / timeout / interval。
  if(scene instanceof ActOneScene) {
    scene.once('handoff-complete',()=>{
      adapter.unbind(); // 停止当前节点捕获，摄像头留给下一幕复用。
      window.dispatchEvent(new CustomEvent('mortal-unlocked',{detail:{sceneId:scene.sceneId}}));
      renderSceneUI();
    });
  } else if(scene instanceof ActTwoScene) {
    scene.once('navigate-to-moon',()=>queueMicrotask(()=>{
      if(currentScene!==scene||scene.destroyed)return;
      lifetime.dispose();currentScene=undefined;
      mountScene(new ActThreeScene());
      window.dispatchEvent(new CustomEvent('navigate-to-moon'));syncFullscreen();
    }));
    scene.once('moon-unlocked',()=>{
      adapter.unbind(); // 完成后由 Pixi 月亮/天空点击接管。
      window.dispatchEvent(new CustomEvent('moon-unlocked',{detail:{sceneId:scene.sceneId}}));
      renderSceneUI();
    });
  }
  const label=scene instanceof ActOneScene?'第一幕 · 后羿得药':scene instanceof ActTwoScene?'第二幕 · 凡间：嫦娥吞药':'第三幕 · 奔月相思';
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
  await loadActTwoAssets();
  await Assets.load(scene3Config.background.url);
  if(!directActTwo) await loadRigAssets();
  const directActThree=scenePreview && previewScene==='act-three';
  const scene = directActThree?new ActThreeScene():directActTwo?new ActTwoScene():new ActOneScene();
  if (previewTime !== null) scene.seek(previewTime);
  // 开发时跳过入场但继续播放，便于重复检查交接；正式构建不启用。
  if (scenePreview && params.get('skipIntro') === '1') scene.seek(directActThree?scene3Config.introSeconds:directActTwo?actTwoConfig.intro.duration:actOneIntroEnd);
  // 开发关键帧检查：通过真实输入和更新完成流程，正式构建不启用。
  if(scenePreview && params.get('pose')==='complete') {
    if(scene instanceof ActThreeScene){scene.seek(scene3Config.introSeconds);scene.ascent.startAssist();for(let i=0;i<800;i++)scene.update({deltaMS:1000/60} as import('pixi.js').Ticker);}
    if(scene instanceof ActTwoScene){scene.seek(actTwoConfig.intro.duration);scene.swallow.input({type:'GRAB',point:scene.swallow.point});scene.swallow.input({type:'MOVE',point:scene.swallow.pointAt(1)});for(let i=0;i<25;i++)scene.update({deltaMS:1000/60} as import('pixi.js').Ticker);scene.swallow.input({type:'RELEASE'});for(let i=0;i<300;i++)scene.update({deltaMS:1000/60} as import('pixi.js').Ticker);}
  }
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
    const old=currentScene;
    if(!(old instanceof ActOneScene)||old.handoff.state!=='complete')return;
    lifetime.dispose();currentScene=undefined;
    mountScene(new ActTwoScene());
    window.dispatchEvent(new CustomEvent('navigate-to-mortal'));
    syncFullscreen();
  },eventOptions);
  replayButton.addEventListener('click',()=>{
    if(!(currentScene instanceof ActThreeScene)||currentScene.ascent.state!=='complete')return;
    lifetime.dispose();currentScene=undefined;mountScene(new ActOneScene());syncFullscreen();
  },eventOptions);
  reviewButton.addEventListener('click',()=>{
    if(!(currentScene instanceof ActThreeScene)||currentScene.ascent.state!=='complete')return;
    reviewPanel.hidden=false;document.querySelector<HTMLButtonElement>('#review-close')!.focus();
  },eventOptions);
  document.querySelector('#review-close')!.addEventListener('click',()=>{reviewPanel.hidden=true;reviewButton.focus();},eventOptions);
  document.querySelector('#review-content')!.replaceChildren();
  for(const text of scene3Config.review){const p=document.createElement('p');p.textContent=text;document.querySelector('#review-content')!.appendChild(p);}
  window.addEventListener('pagehide', () => {app?.stop();lifetime.dispose();input?.dispose();input=undefined;currentScene=undefined;}, { once: true, signal: events.signal });
  if (import.meta.hot) import.meta.hot.dispose(() => {
    events.abort();
    lifetime.dispose();
    input?.dispose();input=undefined;
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
