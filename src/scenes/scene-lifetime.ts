import type { Container } from 'pixi.js';

// 场景资源统一登记，退出时先停输入/更新/声音/计时，再销毁显示树。
export class SceneLifetime {
  private cleanup:(()=>void)[]=[];
  private disposed=false;
  add(cleanup:()=>void):void { if(this.disposed) cleanup();else this.cleanup.push(cleanup); }
  audio(audio:HTMLMediaElement):void { this.add(()=>{audio.pause();audio.currentTime=0;}); }
  timeout(id:ReturnType<typeof setTimeout>):void { this.add(()=>clearTimeout(id)); }
  interval(id:ReturnType<typeof setInterval>):void { this.add(()=>clearInterval(id)); }
  dispose():void {
    if(this.disposed) return;
    this.disposed=true;
    for(const cleanup of this.cleanup.reverse()) cleanup();
    this.cleanup=[];
  }
}

export function destroyScene(scene:Container):void {
  const filters=new Set<{destroy():void}>();
  const visit=(node:Container):void=>{
    if(node.filters) for(const filter of (Array.isArray(node.filters)?node.filters:[node.filters])) filters.add(filter);
    for(const child of node.children) visit(child);
  };
  visit(scene);
  scene.removeFromParent();
  scene.destroy({children:true});
  for(const filter of filters) filter.destroy();
  // Assets 缓存的 PNG 纹理可供其他幕复用，不随人物 Sprite 销毁。
}
