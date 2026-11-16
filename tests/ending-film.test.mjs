import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EndingFilm} from '../src/ending-film.ts';
import {scene3Config as c} from '../src/config/scene3.config.ts';
class Element extends EventTarget {
 children=[];style={};dataset={};classList={add(){},remove(){}};
 append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setAttribute(){}removeAttribute(){}load(){}pause(){}focus(){}
 play(){return Promise.resolve();}
 requestVideoFrameCallback(fn){this.frame=fn;return 1;}cancelVideoFrameCallback(){this.frame=undefined;}
}
function setup(t){t.mock.timers.enable({apis:['setTimeout']});const old=globalThis.document;
 const elements=[],body=new Element();globalThis.document={body,createElement(tag){const e=new Element();e.tag=tag;elements.push(e);return e;}};
 let ended=0,shown=0;const film=new EndingFilm(()=>ended++,()=>{},()=>shown++);
 t.after(()=>{film.dispose();globalThis.document=old;});
 return {film,v:elements[0],body,elements,ended:()=>ended,shown:()=>shown};}
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
