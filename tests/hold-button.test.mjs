import {test} from 'node:test';import assert from 'node:assert/strict';
import {HoldButtonAdapter} from '../src/input/hold-button.ts';
test('辅助按钮按住启动，松手/取消/失焦/销毁均释放捕获；销毁后无监听',()=>{
 globalThis.window=new EventTarget();let starts=0,stops=0;
 class Button extends EventTarget{captured=false;setPointerCapture(){this.captured=true;}hasPointerCapture(){return this.captured;}releasePointerCapture(){this.captured=false;}}
 const b=new Button(),a=new HoldButtonAdapter(b,()=>{starts++;return true;},()=>stops++);
 const down=()=>b.dispatchEvent(Object.assign(new Event('pointerdown',{cancelable:true}),{button:0,isPrimary:true,pointerId:1}));
 for(const end of [()=>b.dispatchEvent(new Event('pointerup')),()=>b.dispatchEvent(new Event('pointercancel')),()=>window.dispatchEvent(new Event('blur')),()=>a.dispose()]){down();assert.equal(b.captured,true);end();assert.equal(b.captured,false);}
 assert.equal(starts,4);assert.equal(stops,4);down();assert.equal(starts,4);delete globalThis.window;
});
