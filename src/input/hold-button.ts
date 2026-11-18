export class HoldButtonAdapter {
 private events=new AbortController();private pointer:number|null=null;
 private button:HTMLButtonElement;private stop:()=>void;
 constructor(button:HTMLButtonElement,start:()=>boolean,stop:()=>void){this.button=button;this.stop=stop;const o={signal:this.events.signal};
 button.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||this.pointer!==null||!start())return;e.preventDefault();this.pointer=e.pointerId;button.setPointerCapture(e.pointerId);},o);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>this.cancel(),o);
 window.addEventListener('blur',()=>this.cancel(),o);
 }
 cancel():void{const id=this.pointer;this.pointer=null;this.stop();if(id!==null&&this.button.hasPointerCapture(id))this.button.releasePointerCapture(id);}
 dispose():void{this.cancel();this.events.abort();}
}
