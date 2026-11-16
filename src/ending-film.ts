import {scene3Config as c} from './config/scene3.config.ts';

/** 场景拥有的 DOM 结尾。预载时不遮住舞台，首个解码帧到达后再切换。 */
export class EndingFilm {
 phase:'idle'|'loading'|'video'|'ending'|'disposed'='idle';
 private video=document.createElement('video');
 private screen:HTMLElement|undefined;
 private events=new AbortController();
 private timers=new Set<ReturnType<typeof setTimeout>>();
 private watchdog:ReturnType<typeof setTimeout>|undefined;
 private frame:number|undefined;
 private failed=false;
 private onEnding:()=>void;private onReplay:()=>void;private onVideo:()=>void;
 constructor(onEnding:()=>void,onReplay:()=>void,onVideo:()=>void){
  this.onEnding=onEnding;this.onReplay=onReplay;this.onVideo=onVideo;
  const v=this.video;
  v.className='ending-film';v.preload='auto';v.autoplay=true;v.muted=true;v.defaultMuted=true;
  v.playsInline=true;v.controls=false;v.loop=false;v.disablePictureInPicture=true;
  const options={signal:this.events.signal};
  v.addEventListener('loadedmetadata',()=>{if(Number.isFinite(v.duration)&&v.duration>c.video.targetSeconds)v.playbackRate=v.duration/c.video.targetSeconds;},options);
  v.addEventListener('error',()=>{this.failed=true;if(this.phase!=='idle')this.finish();},options);
  v.addEventListener('ended',()=>this.finish(),options);
  v.addEventListener('timeupdate',()=>{if(this.phase==='video')this.armWatchdog(c.video.stallTimeoutMs);},options);
  v.addEventListener('playing',()=>{
   if(this.phase!=='loading')return;
   if(typeof v.requestVideoFrameCallback==='function')this.frame=v.requestVideoFrameCallback(()=>this.reveal());
   else this.later(()=>{if(v.readyState>=2)this.reveal();},50);
  },options);
  // 不提前播放：autoplay 属性在真正转场时设置，避免离屏预载消耗视频。
  v.autoplay=false;v.src=c.video.url;v.load();
 }
 private later(fn:()=>void,ms:number){const id=setTimeout(()=>{this.timers.delete(id);if(this.phase!=='disposed')fn();},ms);this.timers.add(id);return id;}
 private armWatchdog(ms:number){if(this.watchdog){clearTimeout(this.watchdog);this.timers.delete(this.watchdog);}this.watchdog=this.later(()=>this.finish(),ms);}
 start():void {
  if(this.phase!=='idle')return;
  this.phase='loading';
  if(this.failed){this.finish();return;}
  this.video.autoplay=true;document.body.append(this.video);
  this.armWatchdog(c.video.startupTimeoutMs);
  void this.video.play().catch(()=>this.finish());
 }
 private reveal():void {
  if(this.phase!=='loading')return;
  this.phase='video';this.video.classList.add('is-visible');
  document.body.dataset.ending='video';this.onVideo();
  this.armWatchdog(c.video.stallTimeoutMs);
  this.later(()=>this.finish(),c.video.maxPlaybackMs);
 }
 private finish():void {
  if(this.phase==='ending'||this.phase==='disposed'||this.phase==='idle')return;
  this.phase='ending';this.clearAsync();this.video.pause();
  const screen=document.createElement('section');screen.className='ending-screen';screen.setAttribute('aria-label','奔月相思 · 结尾');
  screen.style.background=c.video.background;
  const caption=document.createElement('p');caption.className='ending-caption';caption.textContent='清冷月宫，相思无尽';
  caption.style.animationDelay=`${c.video.captionDelayMs}ms`;
  const actions=document.createElement('div');actions.className='ending-actions';actions.style.animationDelay=`${c.video.buttonsDelayMs}ms`;
  const replay=document.createElement('button');replay.textContent='重演';
  const review=document.createElement('button');review.textContent='知识回顾';
  replay.disabled=review.disabled=true;
  const panel=document.createElement('section');panel.className='ending-review';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','知识回顾');
  for(const text of c.review){const p=document.createElement('p');p.textContent=text;panel.append(p);}
  const close=document.createElement('button');close.textContent='返回结尾';panel.append(close);
  const options={signal:this.events.signal};
  replay.addEventListener('click',()=>this.onReplay(),options);
  review.addEventListener('click',()=>{panel.hidden=false;close.focus();},options);
  close.addEventListener('click',()=>{panel.hidden=true;review.focus();},options);
  actions.append(replay,review);screen.append(caption,actions,panel);document.body.append(screen);this.screen=screen;
  document.body.dataset.ending='ending';this.onEnding();
  this.video.style.transition=`opacity ${c.video.fadeMs}ms ease`;
  this.video.classList.remove('is-visible');
  this.later(()=>this.releaseVideo(),c.video.fadeMs);
  this.later(()=>{replay.disabled=review.disabled=false;},c.video.buttonsDelayMs);
 }
 private clearAsync(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();
  if(this.frame!==undefined)this.video.cancelVideoFrameCallback(this.frame);this.frame=undefined;}
 private releaseVideo(){this.video.pause();this.video.remove();this.video.removeAttribute('src');this.video.load();}
 dispose():void{if(this.phase==='disposed')return;this.phase='disposed';this.clearAsync();this.events.abort();this.releaseVideo();this.screen?.remove();delete document.body.dataset.ending;}
}
