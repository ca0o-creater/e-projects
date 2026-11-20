import {scene3Config as c} from './config/scene3.config.ts';
import {EndingAudioManager} from './audio/ending-audio-manager.ts';

interface FilmTimer {
 fn:()=>void; remaining:number; deadline:number; playback:boolean;
 id?:ReturnType<typeof setTimeout>;
}

/** 场景拥有的 DOM 结尾。预载时不遮住舞台，首个解码帧到达后再切换。 */
export class EndingFilm {
 phase:'idle'|'loading'|'video'|'ending'|'disposed'='idle';
 private video=document.createElement('video');
 private screen:HTMLElement|undefined;
 private caption:HTMLElement|undefined;
 private captionShown=false;
 private events=new AbortController();
 private readonly audio=new EndingAudioManager();
 private timers=new Set<FilmTimer>();
 private watchdog:FilmTimer|undefined;
 private frame:number|undefined;
 private frameTimer:FilmTimer|undefined;
 private frameRequest:object|undefined;
 private playRequest:object|undefined;
 private paused=false;
 private failed=false;
 private onEnding:()=>void;private onReplay:()=>void;private onVideo:()=>void;
 private releaseStage:()=>void;
 constructor(onEnding:()=>void,onReplay:()=>void,onVideo:()=>void,releaseStage:()=>void=()=>{}){
  this.onEnding=onEnding;this.onReplay=onReplay;this.onVideo=onVideo;this.releaseStage=releaseStage;
  const v=this.video;
  v.className='ending-film';v.preload='auto';v.autoplay=true;v.muted=true;v.defaultMuted=true;
  v.playsInline=true;v.controls=false;v.loop=false;v.disablePictureInPicture=true;
  const options={signal:this.events.signal};
  v.addEventListener('loadedmetadata',()=>{if(Number.isFinite(v.duration)&&v.duration>c.video.targetSeconds)v.playbackRate=v.duration/c.video.targetSeconds;},options);
  v.addEventListener('error',()=>{this.failed=true;if(this.phase!=='idle')this.finish();},options);
  v.addEventListener('ended',()=>this.finish(),options);
  v.addEventListener('timeupdate',()=>{if(this.phase==='video'&&!this.paused)this.armWatchdog(c.video.stallTimeoutMs);},options);
  v.addEventListener('playing',()=>this.requestFirstFrame(),options);
  // 仅显式 play()，避免离屏预载或后台恢复绕过暂停控制。
  v.autoplay=false;v.src=c.video.url;v.load();
  this.audio.preload();
 }
 private schedule(timer:FilmTimer):void {
  if(timer.playback&&this.paused)return;
  timer.deadline=Date.now()+timer.remaining;
  const id=setTimeout(()=>{
   if(timer.id!==id||!this.timers.has(timer)||(timer.playback&&this.paused))return;
   this.timers.delete(timer);timer.id=undefined;
   if(this.phase!=='disposed')timer.fn();
  },timer.remaining);
  timer.id=id;
 }
 private later(fn:()=>void,ms:number,playback=false):FilmTimer {
  const timer:FilmTimer={fn,remaining:ms,deadline:0,playback};
  this.timers.add(timer);this.schedule(timer);return timer;
 }
 private armWatchdog(ms:number){if(this.watchdog){clearTimeout(this.watchdog.id);this.timers.delete(this.watchdog);}this.watchdog=this.later(()=>this.finish(),ms,true);}
 private requestFirstFrame():void {
  if(this.phase!=='loading'||this.paused||this.frameRequest)return;
  const request=this.frameRequest={};
  const reveal=()=>{
   if(this.frameRequest!==request)return;
   this.frameRequest=undefined;this.frame=undefined;
   this.reveal();
  };
  if(typeof this.video.requestVideoFrameCallback==='function')this.frame=this.video.requestVideoFrameCallback(reveal);
  else this.frameTimer=this.later(()=>{if(this.video.readyState>=2)reveal();else this.frameRequest=undefined;},50,true);
 }
 private playVideo():void {
  const request=this.playRequest={};
  const current=()=>this.playRequest===request&&!this.paused&&(this.phase==='loading'||this.phase==='video');
  try {
   void this.video.play().then(()=>{if(current())this.requestFirstFrame();},()=>{if(current())this.finish();});
  }catch{if(current())this.finish();}
 }
 start():void {
  if(this.phase!=='idle')return;
  this.phase='loading';
  if(this.failed){this.finish();return;}
  document.body.append(this.video);
  this.armWatchdog(c.video.startupTimeoutMs);
  if(!this.paused)this.playVideo();
 }
 pause():void {
  if(this.paused||this.phase==='disposed')return;
  this.paused=true;this.playRequest=undefined;
  this.video.pause();
  this.audio.pause();
  if(this.caption)this.caption.style.animationPlayState='paused';
  this.cancelFrame();
  for(const timer of this.timers)if(timer.playback&&timer.id!==undefined){
   clearTimeout(timer.id);timer.id=undefined;timer.remaining=Math.max(0,timer.deadline-Date.now());
  }
 }
 resume():void {
  if(!this.paused||this.phase==='disposed')return;
  this.paused=false;
  for(const timer of this.timers)if(timer.playback)this.schedule(timer);
  if(this.phase==='loading'||this.phase==='video')this.playVideo();
  this.audio.resume(this.phase==='video'?this.displayTime():undefined);
  if(this.caption)this.caption.style.animationPlayState='running';
 }
 retryBlocked():void {
  if(this.phase==='video'&&!this.paused)this.audio.retryBlocked(this.displayTime());
  else if(this.phase==='ending'&&this.captionShown&&!this.paused)this.audio.retryBlocked();
 }
 private displayTime():number {
  return (this.video.currentTime||0)/(this.video.playbackRate||1);
 }
 private reveal():void {
  if(this.phase!=='loading'||this.paused)return;
   this.phase='video';this.onVideo(); // 先停旧场景音，再播结尾音、释放输入并显示首帧。
   if(this.phase!=='video')return;
   this.audio.start();
   this.releaseStage();
   if(this.phase!=='video')return;
   this.video.classList.add('is-visible');
   document.body.dataset.ending='video';
  this.armWatchdog(c.video.stallTimeoutMs);
  this.later(()=>this.finish(),c.video.maxPlaybackMs,true);
 }
 private finish():void {
  if(this.phase==='ending'||this.phase==='disposed'||this.phase==='idle')return;
  this.phase='ending';this.clearAsync();this.video.pause();this.audio.stopVideoAudio();
  const screen=document.createElement('section');screen.className='ending-screen';screen.setAttribute('aria-label','奔月相思 · 结尾');
  screen.style.background=c.video.background;
  const caption=this.caption=document.createElement('p');caption.className='ending-caption';caption.textContent=c.video.captionText;
  caption.style.animationPlayState=this.paused?'paused':'running';
  const actions=document.createElement('div');actions.className='ending-actions';actions.style.animationDelay=`${c.video.buttonsDelayMs}ms`;
  const replay=document.createElement('button');replay.textContent='重演';
  const review=document.createElement('button');review.textContent='知识回顾';
  replay.disabled=review.disabled=true;
  const panel=document.createElement('section');panel.className='ending-review';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','知识回顾');
  for(const text of c.review){const p=document.createElement('p');p.textContent=text;panel.append(p);}
  const close=document.createElement('button');close.textContent='返回结尾';panel.append(close);
  const options={signal:this.events.signal};
  replay.addEventListener('click',()=>{this.dispose();this.onReplay();},options);
  review.addEventListener('click',()=>{this.audio.stopCaption();panel.hidden=false;close.focus();},options);
  close.addEventListener('click',()=>{panel.hidden=true;review.focus();},options);
  actions.append(replay,review);screen.append(caption,actions,panel);document.body.append(screen);this.screen=screen;
  document.body.dataset.ending='ending';this.onEnding();
  this.video.style.transition=`opacity ${c.video.fadeMs}ms ease`;
  this.video.classList.remove('is-visible');
  this.later(()=>this.releaseVideo(),c.video.fadeMs);
  this.later(()=>{
   if(this.phase!=='ending'||this.captionShown)return;
   this.captionShown=true;
   caption.classList.add('is-visible');
   this.audio.playCaption();
   this.later(()=>this.audio.expireCaptionRetry(),c.video.captionVoiceSeconds*1000,true);
  },c.video.captionDelayMs,true);
  this.later(()=>{replay.disabled=review.disabled=false;},c.video.buttonsDelayMs);
 }
 private cancelFrame(){this.frameRequest=undefined;
  if(this.frameTimer){clearTimeout(this.frameTimer.id);this.timers.delete(this.frameTimer);this.frameTimer=undefined;}
  if(this.frame!==undefined)this.video.cancelVideoFrameCallback(this.frame);this.frame=undefined;}
 private clearAsync(){for(const timer of this.timers)clearTimeout(timer.id);this.timers.clear();
  this.watchdog=undefined;this.playRequest=undefined;this.cancelFrame();}
 private releaseVideo(){this.video.pause();this.video.remove();this.video.removeAttribute('src');this.video.load();}
 dispose():void{if(this.phase==='disposed')return;this.phase='disposed';this.clearAsync();this.audio.dispose();this.events.abort();this.releaseVideo();this.screen?.remove();delete document.body.dataset.ending;}
}
