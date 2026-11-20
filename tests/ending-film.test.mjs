import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EndingFilm} from '../src/ending-film.ts';
import {scene3Config as c} from '../src/config/scene3.config.ts';
import {FakeAudio, Element, flush} from './helpers/ending-media.mjs';
import {Scene3AudioManager} from '../src/audio/scene3-audio-manager.ts';
import {MoonTransition} from '../src/audio/moon-transition.ts';
import {SceneLifetime} from '../src/scenes/scene-lifetime.ts';
function setup(t,{beforeVideo=()=>{},replay=()=>{},releaseStage=()=>{}}={}){t.mock.timers.enable({apis:['setTimeout','Date']});const old=globalThis.document,oldAudio=globalThis.Audio;
 globalThis.Audio=FakeAudio;FakeAudio.instances=[];
 const elements=[],body=new Element();globalThis.document={body,createElement(tag){const e=new Element();e.tag=tag;elements.push(e);return e;}};
 let ended=0,shown=0;const film=new EndingFilm(()=>ended++,replay,()=>{beforeVideo();shown++;},releaseStage);
 t.after(()=>{film.dispose();globalThis.document=old;globalThis.Audio=oldAudio;});
 return {film,v:elements[0],body,elements,moon:FakeAudio.instances[0],cry:FakeAudio.instances[1],voice:FakeAudio.instances[2],ended:()=>ended,shown:()=>shown};}
test('首个视频帧到达才隐藏舞台；ended只收尾一次，淡出后释放视频，按钮延迟开放',t=>{
 const {film,v,body,ended,shown,elements}=setup(t);
 assert.equal(body.children.length,0);film.start();assert.equal(film.phase,'loading');
 v.dispatchEvent(new Event('playing'));assert.equal(body.dataset.ending,undefined);
 v.frame();assert.equal(shown(),1);assert.equal(body.dataset.ending,'video');
 v.dispatchEvent(new Event('ended'));v.dispatchEvent(new Event('ended'));assert.equal(ended(),1);
 assert.equal(film.phase,'ending');assert.equal(elements.find(e=>e.textContent==='重演').disabled,true);
 t.mock.timers.tick(c.video.buttonsDelayMs);assert.ok(!body.children.includes(v));
 assert.equal(elements.find(e=>e.textContent==='重演').disabled,false);
});
test('缺失、播放拒绝、首帧超时均回退且不会留下视频',async t=>{
 const {film,v,ended,body}=setup(t);v.play=()=>Promise.reject(new Error('blocked'));
 film.start();await Promise.resolve();assert.equal(ended(),1);
 t.mock.timers.tick(c.video.fadeMs);assert.ok(!body.children.includes(v));
});
test('预载失败直接进入结尾；重复开始无效',t=>{
 const {film,v,ended}=setup(t);v.dispatchEvent(new Event('error'));assert.equal(ended(),0);
 film.start();film.start();assert.equal(ended(),1);
});
test('首帧超时和已播放卡顿有界回退',t=>{
 const {film,ended}=setup(t);film.start();t.mock.timers.tick(c.video.startupTimeoutMs);assert.equal(ended(),1);
});
test('播放中断回退；销毁移除DOM与监听，迟到的首帧不能复活',t=>{
 const {film,v,body,ended}=setup(t);film.start();v.dispatchEvent(new Event('playing'));const late=v.frame;late();
 t.mock.timers.tick(c.video.stallTimeoutMs);assert.equal(ended(),1);
 film.dispose();late();v.dispatchEvent(new Event('ended'));t.mock.timers.tick(40000);
 assert.equal(film.phase,'disposed');assert.equal(body.children.length,0);assert.equal(body.dataset.ending,undefined);assert.equal(ended(),1);
});

test('loading/playing 保持静音；首帧先清第三幕和转场，再同时播两音轨，最后显示', async t => {
 let scene, transition;const order=[];
 const f=setup(t,{beforeVideo:()=>{scene.stopAllAudio();transition.stopAllAudio();},releaseStage:()=>order.push('release-input')});
 scene=new Scene3AudioManager();transition=new MoonTransition();
 t.after(()=>{scene.dispose();transition.dispose();});
 scene.start({state:'ready',assisting:false,inTarget:false,charging:false});
 scene.onState({state:'ending'}, {state:'armed'});
 transition.navigate(()=>true,()=>{});await flush();
 const previous=FakeAudio.instances.slice(3);
 assert.ok(previous.some(a=>!a.paused));
 for(const [key,a] of [['moon',f.moon],['cry',f.cry]])a.play=function(){
  assert.ok(previous.every(a=>a.paused&&a.currentTime===0));order.push(key);
  return FakeAudio.prototype.play.call(this);
 };
 f.v.classList.add=()=>{order.push('visible');assert.equal(f.moon.plays,1);assert.equal(f.cry.plays,1);};
 f.film.start();assert.equal(f.moon.plays,0);assert.equal(f.cry.plays,0);
 f.v.dispatchEvent(new Event('playing'));assert.equal(f.moon.plays,0);assert.equal(f.cry.plays,0);
 const frame=f.v.frame;frame();frame();f.film.start();
 f.v.dispatchEvent(new Event('playing'));f.v.dispatchEvent(new Event('timeupdate'));
 assert.deepEqual(order,['moon','cry','release-input','visible']);assert.equal(f.shown(),1);
 assert.deepEqual(f.cry.starts,[0]);assert.deepEqual(f.moon.starts,[0]);
});

test('视频5.04秒映射4秒，原AAC保持双重静音，外部WAV仍为1倍速', t => {
 const f=setup(t);f.v.dispatchEvent(new Event('loadedmetadata'));
 assert.equal(f.v.playbackRate,1.26);assert.equal(f.v.duration/f.v.playbackRate,c.video.targetSeconds);
 f.film.start();f.v.dispatchEvent(new Event('playing'));f.v.frame();
 assert.equal(f.v.muted,true);assert.equal(f.v.defaultMuted,true);
 assert.equal(f.cry.playbackRate,1);assert.equal(f.moon.playbackRate,1);
});

for(const failure of ['preload-error','loading-error','rejected','startup-timeout','playing-without-frame']){
 test(`首帧前 ${failure} 回退正常且两条结尾音轨从未播放`,async t=>{
  const f=setup(t);
  if(failure==='preload-error')f.v.dispatchEvent(new Event('error'));
  if(failure==='rejected')f.v.play=()=>Promise.reject(new Error('blocked'));
  f.film.start();
  if(failure==='loading-error')f.v.dispatchEvent(new Event('error'));
  if(failure==='playing-without-frame')f.v.dispatchEvent(new Event('playing'));
  await flush();t.mock.timers.tick(c.video.startupTimeoutMs);
  assert.equal(f.film.phase,'ending');assert.equal(f.shown(),0);
  assert.equal(f.moon.plays,0);assert.equal(f.cry.plays,0);
  assert.ok(f.elements.some(e=>e.textContent==='清冷月宫，相思无尽'));
  assert.ok(f.elements.some(e=>e.textContent==='重演'));assert.ok(f.elements.some(e=>e.textContent==='知识回顾'));
  f.film.resume();f.film.retryBlocked();assert.equal(f.cry.plays,0);
 });
}

for(const failure of ['ended','error','stall','maximum']){
 test(`首帧后 ${failure} 立即停止结尾声音并归零；迟到输入不补播`,t=>{
  const f=setup(t);f.film.start();f.v.dispatchEvent(new Event('playing'));f.v.frame();
  f.cry.currentTime=.8;f.moon.currentTime=.8;
  if(failure==='stall')t.mock.timers.tick(c.video.stallTimeoutMs);
  else if(failure==='maximum'){
   for(let ms=1000;ms<c.video.maxPlaybackMs;ms+=1000){
    t.mock.timers.tick(1000);f.v.dispatchEvent(new Event('timeupdate'));assert.equal(f.film.phase,'video');
   }
   t.mock.timers.tick(1000);
  }else f.v.dispatchEvent(new Event(failure));
  assert.equal(f.film.phase,'ending');assert.equal(f.ended(),1);
  f.film.resume();f.film.retryBlocked();
  for(const a of [f.moon,f.cry]){assert.equal(a.paused,true);assert.equal(a.currentTime,0);assert.equal(a.plays,1);}
 });
}

test('后台/退出全屏暂停视频及两声音，保留位置；恢复按显示时间校正且不重复首帧',async t=>{
 const f=setup(t);f.v.dispatchEvent(new Event('loadedmetadata'));
 f.film.start();f.v.dispatchEvent(new Event('playing'));f.v.frame();await flush();
 f.v.currentTime=.63;f.moon.currentTime=.5;f.cry.currentTime=.3;
 f.film.pause();f.film.pause();
 assert.equal(f.v.paused,true);assert.equal(f.moon.paused,true);assert.equal(f.cry.paused,true);
 assert.equal(f.v.currentTime,.63);assert.equal(f.cry.currentTime,.3);
 t.mock.timers.tick(60000);assert.equal(f.film.phase,'video');
 f.film.retryBlocked();assert.equal(f.cry.plays,1);
 f.film.resume();await flush();f.film.resume();
 assert.deepEqual(f.v.starts,[0,.63]);assert.deepEqual(f.moon.starts,[0,.5]);assert.deepEqual(f.cry.starts,[0,.5]);
 assert.equal(f.shown(),1);assert.equal(f.v.paused,false);
 f.v.currentTime=2.52;f.film.pause();f.film.resume();await flush();
 assert.equal(f.moon.plays,2);assert.equal(f.moon.paused,true);assert.equal(f.cry.currentTime,2);
});

test('loading 暂停不误触发超时，过期首帧无效，恢复后的新帧才启动',async t=>{
 const f=setup(t);f.film.start();f.v.dispatchEvent(new Event('playing'));const late=f.v.frame;
 t.mock.timers.tick(2000);f.film.pause();t.mock.timers.tick(60000);
 late();f.v.dispatchEvent(new Event('playing'));assert.equal(f.film.phase,'loading');assert.equal(f.cry.plays,0);
 f.film.resume();await flush();late();assert.equal(f.cry.plays,0);
 f.v.frame();assert.equal(f.film.phase,'video');assert.equal(f.cry.plays,1);
});

test('暂停保留 startup、stall 和最大播放计时预算，而非后台超时或无限续期',t=>{
 const f=setup(t);f.film.start();t.mock.timers.tick(2000);f.film.pause();t.mock.timers.tick(60000);f.film.resume();
 t.mock.timers.tick(3000);assert.equal(f.film.phase,'loading');
 f.v.dispatchEvent(new Event('playing'));f.v.frame();
 for(let elapsed=0;elapsed<28000;elapsed+=1000){t.mock.timers.tick(1000);f.v.dispatchEvent(new Event('timeupdate'));}
 f.film.pause();t.mock.timers.tick(60000);f.film.resume();
 t.mock.timers.tick(1000);f.v.dispatchEvent(new Event('timeupdate'));assert.equal(f.film.phase,'video');
 t.mock.timers.tick(1000);assert.equal(f.film.phase,'ending');
});

test('旧 video.play 拒绝不能终止恢复后的新请求；首帧回调回退可暂停',async t=>{
 const f=setup(t);let reject;f.v.play=()=>new Promise((_,fail)=>{reject=fail;});
 f.film.start();f.film.pause();f.v.play=Element.prototype.play;f.v.requestVideoFrameCallback=undefined;
 f.film.resume();await flush();reject(new Error('old'));await flush();
 f.film.pause();t.mock.timers.tick(100);assert.equal(f.cry.plays,0);
 f.film.resume();await flush();t.mock.timers.tick(50);
 assert.equal(f.film.phase,'video');assert.equal(f.cry.plays,1);
});

test('音轨加载或自动播放失败不阻断画面；权限重试仅限未暂停的 video 阶段',async t=>{
 const f=setup(t);f.moon.error={code:4};
 f.cry.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));
 f.film.start();f.v.dispatchEvent(new Event('playing'));f.v.frame();await flush();
 assert.equal(f.film.phase,'video');assert.equal(f.body.dataset.ending,'video');
 f.cry.play=FakeAudio.prototype.play;f.v.currentTime=2;f.film.retryBlocked();await flush();
 assert.deepEqual(f.cry.starts,[2]);assert.equal(f.moon.plays,0);
 f.v.dispatchEvent(new Event('ended'));f.film.retryBlocked();assert.equal(f.cry.plays,1);
});

test('重演和 pagehide/HMR 所用 lifetime 清理释放资源，旧回调不污染新结尾；知识回顾可用',async t=>{
 let replayed=0;const life=new SceneLifetime();
 const f=setup(t,{replay:()=>{replayed++;life.dispose();}});life.add(()=>f.film.dispose());
 f.film.start();f.v.dispatchEvent(new Event('playing'));const late=f.v.frame;late();
 const audioCallbacks=[...f.cry.listeners.values()].flatMap(set=>[...set]);
 f.v.dispatchEvent(new Event('ended'));t.mock.timers.tick(c.video.buttonsDelayMs);
 const review=f.elements.find(e=>e.textContent==='知识回顾');const panel=f.elements.find(e=>e.className==='ending-review');
 review.dispatchEvent(new Event('click'));assert.equal(panel.hidden,false);
 f.elements.find(e=>e.textContent==='返回结尾').dispatchEvent(new Event('click'));assert.equal(panel.hidden,true);
 f.elements.find(e=>e.textContent==='重演').dispatchEvent(new Event('click'));assert.equal(replayed,1);
 life.dispose();f.film.dispose();
 const next=new EndingFilm(()=>{},()=>{},()=>{});t.after(()=>next.dispose());next.start();
 const nextVideo=f.elements.filter(e=>e.tag==='video').at(-1);nextVideo.dispatchEvent(new Event('playing'));nextVideo.frame();
 late();for(const cb of audioCallbacks)cb();
 for(const type of ['playing','ended','error'])f.v.dispatchEvent(new Event(type));
 await flush();f.film.resume();f.film.retryBlocked();
 assert.equal(next.phase,'video');assert.ok(FakeAudio.instances.slice(-3,-1).every(a=>!a.paused&&a.plays===1));
 for(const a of [f.moon,f.cry]){
  assert.equal(a.src,'');assert.equal(a.currentTime,0);assert.equal(a.paused,true);
  assert.ok([...a.listeners.values()].every(set=>set.size===0));
 }
 next.dispose();
});

function showVideo(f) { f.film.start(); f.v.dispatchEvent(new Event('playing')); f.v.frame(); }
function endVideo(f) { showVideo(f); f.v.dispatchEvent(new Event('ended')); }
function captionElement(f) { return f.elements.find(e=>e.className==='ending-caption'); }

test('视频不播放caption；结束后699ms仍隐藏，700ms同一回调先淡入再播旁白且只播一次', t => {
 const f=setup(t);assert.equal(f.voice.plays,0);showVideo(f);
 t.mock.timers.tick(1000);f.v.dispatchEvent(new Event('timeupdate'));assert.equal(f.voice.plays,0);
 f.v.dispatchEvent(new Event('ended'));const caption=captionElement(f),order=[];
 assert.equal(caption.textContent,c.video.captionText);assert.equal(caption.style.animationDelay,undefined);
 caption.classList.add=name=>{caption.classes.add(name);order.push(['visible',Date.now()]);};
 f.voice.play=function(){assert.equal(caption.classList.contains('is-visible'),true);order.push(['voice',Date.now()]);return FakeAudio.prototype.play.call(this);};
 t.mock.timers.tick(c.video.captionDelayMs-1);assert.equal(f.voice.plays,0);assert.equal(caption.classList.contains('is-visible'),false);
 t.mock.timers.tick(1);assert.equal(f.voice.plays,1);assert.equal(order.length,2);assert.equal(order[0][1],order[1][1]);
 for(const event of ['ended','error','playing','timeupdate'])f.v.dispatchEvent(new Event(event));
 t.mock.timers.tick(10000);assert.equal(f.voice.plays,1);assert.equal(f.ended(),1);
 assert.equal(f.v.muted,true);assert.equal(f.v.defaultMuted,true);
});

for(const failure of ['missing','play-rejection','startup','stall','error','maximum']){
 test(`${failure} 回退仍在字幕淡入时播放caption；moon和cry已停止`,async t=>{
  const f=setup(t);
  if(failure==='missing')f.v.dispatchEvent(new Event('error'));
  if(failure==='play-rejection')f.v.play=()=>Promise.reject(new Error('denied'));
  f.film.start();
  if(['stall','error','maximum'].includes(failure)){f.v.dispatchEvent(new Event('playing'));f.v.frame();}
  if(failure==='startup')t.mock.timers.tick(c.video.startupTimeoutMs);
  if(failure==='stall')t.mock.timers.tick(c.video.stallTimeoutMs);
  if(failure==='error')f.v.dispatchEvent(new Event('error'));
  if(failure==='maximum')for(let ms=0;ms<c.video.maxPlaybackMs;ms+=1000){t.mock.timers.tick(1000);f.v.dispatchEvent(new Event('timeupdate'));}
  await flush();assert.equal(f.film.phase,'ending');assert.equal(f.voice.plays,0);
  for(const a of [f.moon,f.cry]){assert.equal(a.paused,true);assert.equal(a.currentTime,0);}
  t.mock.timers.tick(c.video.captionDelayMs-1);assert.equal(f.voice.plays,0);
  t.mock.timers.tick(1);assert.equal(f.voice.plays,1);assert.equal(captionElement(f).classList.contains('is-visible'),true);
 });
}

test('字幕延迟期间后台冻结，恢复只走剩余延迟；淡入和旁白暂停时一同冻结',async t=>{
 const f=setup(t);endVideo(f);t.mock.timers.tick(300);f.film.pause();
 const caption=captionElement(f);t.mock.timers.tick(60000);
 assert.equal(f.voice.plays,0);assert.equal(caption.classList.contains('is-visible'),false);
 f.film.resume();t.mock.timers.tick(c.video.captionDelayMs-301);assert.equal(f.voice.plays,0);
 t.mock.timers.tick(1);assert.equal(f.voice.plays,1);await flush();
 f.voice.currentTime=.25;f.film.pause();assert.equal(caption.style.animationPlayState,'paused');
 t.mock.timers.tick(60000);assert.equal(f.voice.currentTime,.25);assert.equal(f.voice.paused,true);
 f.film.resume();await flush();f.film.resume();assert.equal(caption.style.animationPlayState,'running');
 assert.deepEqual(f.voice.starts,[0,.25]); // HTMLAudio.play() 用于续播，但没有第二次从0开始。
 assert.equal(f.moon.plays,1);assert.equal(f.cry.plays,1);assert.equal(f.moon.paused,true);assert.equal(f.cry.paused,true);
 f.voice.end();f.film.pause();f.film.resume();f.film.retryBlocked();assert.equal(f.voice.plays,2);
});

test('loading暂停时收到视频错误，结束旁白延迟仍等待页面恢复',t=>{
 const f=setup(t);f.film.start();f.film.pause();f.v.dispatchEvent(new Event('error'));
 t.mock.timers.tick(60000);assert.equal(f.voice.plays,0);
 f.film.resume();t.mock.timers.tick(c.video.captionDelayMs);assert.equal(f.voice.plays,1);
 assert.equal(f.moon.plays,0);assert.equal(f.cry.plays,0);
});

test('知识回顾停止并释放caption，返回结尾/重复点击/暂停恢复均不补播',async t=>{
 const f=setup(t);endVideo(f);t.mock.timers.tick(c.video.captionDelayMs);await flush();
 t.mock.timers.tick(c.video.buttonsDelayMs-c.video.captionDelayMs);f.voice.currentTime=.9;
 const review=f.elements.find(e=>e.textContent==='知识回顾'),close=f.elements.find(e=>e.textContent==='返回结尾');
 review.dispatchEvent(new Event('click'));assert.equal(f.voice.paused,true);assert.equal(f.voice.currentTime,0);assert.equal(f.voice.src,'');
 close.dispatchEvent(new Event('click'));review.dispatchEvent(new Event('click'));close.dispatchEvent(new Event('click'));
 f.film.retryBlocked();f.film.pause();f.film.resume();t.mock.timers.tick(60000);assert.equal(f.voice.plays,1);
});

test('延迟冻结时打开回顾，恢复后字幕仍显示但已取消旁白',t=>{
 const f=setup(t);endVideo(f);f.film.pause();t.mock.timers.tick(c.video.buttonsDelayMs);
 f.elements.find(e=>e.textContent==='知识回顾').dispatchEvent(new Event('click'));
 f.elements.find(e=>e.textContent==='返回结尾').dispatchEvent(new Event('click'));
 f.film.resume();t.mock.timers.tick(c.video.captionDelayMs);
 assert.equal(f.voice.plays,0);assert.equal(captionElement(f).classList.contains('is-visible'),true);
});

test('重演自身同步销毁旧音频，即使外部回调没有负责清理；重复点击不重演两次',t=>{
 let replayed=0;const f=setup(t,{replay:()=>replayed++});endVideo(f);
 t.mock.timers.tick(c.video.captionDelayMs);t.mock.timers.tick(c.video.buttonsDelayMs-c.video.captionDelayMs);
 f.voice.currentTime=.9;const replay=f.elements.find(e=>e.textContent==='重演');
 replay.dispatchEvent(new Event('click'));replay.dispatchEvent(new Event('click'));
 assert.equal(replayed,1);assert.equal(f.film.phase,'disposed');assert.equal(f.voice.currentTime,0);assert.equal(f.voice.paused,true);assert.equal(f.voice.src,'');
 t.mock.timers.tick(60000);assert.equal(f.voice.plays,1);
});

for(const failure of ['load','reject'])test(`caption ${failure} 失败不影响字幕、按钮及回顾`,async t=>{
 const f=setup(t);if(failure==='load')f.voice.error={code:4};else f.voice.play=()=>Promise.reject(new Error('decode'));
 endVideo(f);t.mock.timers.tick(c.video.captionDelayMs);await flush();
 assert.equal(captionElement(f).classList.contains('is-visible'),true);
 t.mock.timers.tick(c.video.buttonsDelayMs-c.video.captionDelayMs);
 const review=f.elements.find(e=>e.textContent==='知识回顾');assert.equal(review.disabled,false);
 review.dispatchEvent(new Event('click'));assert.equal(f.elements.find(e=>e.className==='ending-review').hidden,false);
 assert.equal(f.film.phase,'ending');
});

test('受限旁白只在字幕已触发且未暂停时可重试；有效窗口内暂停不消耗3秒预算',async t=>{
 const f=setup(t);f.voice.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));
 f.film.retryBlocked();showVideo(f);f.film.retryBlocked();assert.equal(f.voice.plays,0);
 f.v.dispatchEvent(new Event('ended'));f.film.retryBlocked();assert.equal(f.voice.plays,0);
 t.mock.timers.tick(c.video.captionDelayMs);await flush();t.mock.timers.tick(1000);f.film.pause();
 f.voice.play=FakeAudio.prototype.play;t.mock.timers.tick(60000);f.film.retryBlocked();assert.equal(f.voice.plays,0);
 f.film.resume();await flush();assert.deepEqual(f.voice.starts,[0]);
 f.voice.currentTime=2;f.voice.end();f.film.retryBlocked();assert.equal(f.voice.plays,1);
});

test('3秒窗口过后及知识回顾中，不再补播被阻止的旁白',async t=>{
 const f=setup(t);f.voice.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));
 endVideo(f);t.mock.timers.tick(c.video.captionDelayMs);await flush();
 t.mock.timers.tick(c.video.captionVoiceSeconds*1000);f.voice.play=FakeAudio.prototype.play;
 f.film.retryBlocked();f.film.pause();f.film.resume();assert.equal(f.voice.plays,0);
 f.elements.find(e=>e.textContent==='知识回顾').dispatchEvent(new Event('click'));f.film.retryBlocked();
 assert.equal(f.voice.plays,0);
});

test('dispose取消尚未触发的字幕定时器；播放中的caption释放监听，迟到拒绝无效',async t=>{
 const f=setup(t);endVideo(f);const caption=captionElement(f);f.film.dispose();t.mock.timers.tick(60000);
 assert.equal(caption.classList.contains('is-visible'),false);assert.equal(f.voice.plays,0);assert.equal(f.voice.src,'');
 const next=new EndingFilm(()=>{},()=>{},()=>{});const voice=FakeAudio.instances.at(-1);let reject;
 voice.play=()=>new Promise((_,fail)=>{reject=fail;});next.start();
 const video=f.elements.filter(e=>e.tag==='video').at(-1);video.dispatchEvent(new Event('error'));
 t.mock.timers.tick(c.video.captionDelayMs);const callbacks=[...voice.listeners.values()].flatMap(s=>[...s]);
 voice.currentTime=1;next.dispose();next.dispose();reject(new Error('old'));for(const cb of callbacks)cb();await flush();
 next.resume();next.retryBlocked();assert.equal(voice.src,'');assert.equal(voice.currentTime,0);assert.equal(voice.paused,true);
 assert.ok([...voice.listeners.values()].every(s=>s.size===0));
});
