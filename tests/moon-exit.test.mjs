import {test} from 'node:test';import assert from 'node:assert/strict';
import {moonExitAt} from '../src/scenes/moon-exit.ts';
import {scene2Config as c} from '../src/config/scene2.config.ts';
test('未吞药时明月隐藏，吞药后随飞升淡入；完全显现且剧情完成才开放转场',()=>{
 for(const state of ['intro','ready','dragging','armed','returning','disposed'])assert.deepEqual(moonExitAt(state,100),{alpha:0,enabled:false});
 const start=c.ending.swallowSeconds,end=start+c.moon.fadeSeconds;
 assert.deepEqual(moonExitAt('swallowing',start),{alpha:0,enabled:false});
 assert.ok(Math.abs(moonExitAt('swallowing',(start+end)/2).alpha-.5)<1e-9);
 assert.equal(moonExitAt('swallowing',end).enabled,false);
 assert.equal(moonExitAt('complete',end-.01).enabled,false);
 assert.deepEqual(moonExitAt('complete',start+c.ending.riseSeconds),{alpha:1,enabled:true});
});
