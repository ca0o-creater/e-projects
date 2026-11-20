export class HoldButtonAdapter {
 private events=new AbortController();private pointer:number|null=null;
 private button:HTMLButtonElement;private stop:(cancelled:boolean)=>void;
 constructor(button:HTMLButtonElement,start:()=>boolean,stop:(cancelled:boolean)=>void){this.button=button;this.stop=stop;const o={signal:this.events.signal};
 button.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||this.pointer!==null||!start())return;e.preventDefault();this.pointer=e.pointerId;button.setPointerCapture(e.pointerId);},o);
 button.addEventListener('pointerup',()=>this.cancel(false),o);
 for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,()=>this.cancel(),o);
 window.addEventListener('blur',()=>this.cancel(),o);
 }
 cancel(cancelled=true):void{const id=this.pointer;this.pointer=null;this.stop(cancelled);if(id!==null&&this.button.hasPointerCapture(id))this.button.releasePointerCapture(id);}
 dispose():void{this.cancel();this.events.abort();}
}
