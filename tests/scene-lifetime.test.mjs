import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Container} from 'pixi.js';
import {SceneLifetime,destroyScene} from '../src/scenes/scene-lifetime.ts';

test('切幕先清输入与ticker，再销毁显示树；声音计时器停止且可重复清理',async()=>{
  const stage=new Container(),scene=new Container(),child=new Container(),grandchild=new Container();
  stage.addChild(scene);scene.addChild(child);child.addChild(grandchild);
  const life=new SceneLifetime(),order=[];let timerFired=false;
  life.add(()=>{order.push('destroy');destroyScene(scene);});
  life.add(()=>order.push('ticker'));life.add(()=>order.push('input'));
  const audio={currentTime:12,pause(){order.push('audio');}};life.audio(audio);
  life.timeout(setTimeout(()=>{timerFired=true;},10));
  life.interval(setInterval(()=>{timerFired=true;},10));
  life.dispose();life.dispose();
  assert.deepEqual(order,['audio','input','ticker','destroy']);assert.equal(audio.currentTime,0);
  assert.equal(stage.children.length,0);
  for(const node of [scene,child,grandchild]) assert.equal(node.destroyed,true);
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(timerFired,false);
});
