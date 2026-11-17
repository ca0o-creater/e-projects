import { gestureConfig as config } from '../config/gesture.config.ts';
import { mirrorPoint } from './gesture-mapping.ts';
import type { Landmark, GestureDiagnostics } from './pinch-controller.ts';

const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

/** All layers use the same uncropped, mirrored video coordinate system. */
export function drawGesturePreview(canvas: HTMLCanvasElement, video: HTMLVideoElement | null,
  landmarks: readonly Landmark[] = []): void {
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const width=video?.videoWidth || config.preview.width, height=video?.videoHeight || config.preview.height;
  const targetHeight=Math.round(config.preview.width*height/width);
  if(canvas.width!==config.preview.width || canvas.height!==targetHeight) {
    canvas.width=config.preview.width;canvas.height=targetHeight;
  }
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#171e25';ctx.fillRect(0,0,w,h);
  if(video && video.readyState>=2) {
    ctx.save();if(config.mirrorX){ctx.translate(w,0);ctx.scale(-1,1);}
    ctx.drawImage(video,0,0,w,h);ctx.restore();
  }
  const r=config.roi;
  ctx.fillStyle='#00000066';
  ctx.fillRect(0,0,w,r.y*h);ctx.fillRect(0,(r.y+r.height)*h,w,(1-r.y-r.height)*h);
  ctx.fillRect(0,r.y*h,r.x*w,r.height*h);ctx.fillRect((r.x+r.width)*w,r.y*h,(1-r.x-r.width)*w,r.height*h);
  ctx.strokeStyle='#8bffca';ctx.lineWidth=2;ctx.setLineDash([6,4]);
  ctx.strokeRect(r.x*w,r.y*h,r.width*w,r.height*h);ctx.setLineDash([]);
  const points=landmarks.map(p=>{const m=mirrorPoint(p);return {x:m.x*w,y:m.y*h};});
  ctx.strokeStyle='#ffe197';ctx.lineWidth=2;
  for(const [a,b] of connections) {
    if(!points[a]||!points[b])continue;
    ctx.beginPath();ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);ctx.stroke();
  }
  points.forEach((p,i)=>{
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    ctx.fillStyle=i===4||i===8?'#ff8871':'#faffed';ctx.beginPath();ctx.arc(p.x,p.y,i===4||i===8?4:2.5,0,Math.PI*2);ctx.fill();
  });
  ctx.fillStyle='#8bffca';ctx.font='12px sans-serif';ctx.fillText('有效操偶区',r.x*w+5,r.y*h+16);
}

export class GesturePreview {
  readonly root=document.createElement('aside');
  readonly canvas=document.createElement('canvas');
  readonly toggle=document.createElement('button');
  readonly metrics=document.createElement('pre');
  private enabled=false;
  private collapsed=false;
  private panelVisible=true;
  private readonly events=new AbortController();

  constructor(stage: HTMLElement, panel: HTMLElement) {
    this.root.className='gesture-preview';this.root.id='gesture-preview';
    this.root.setAttribute('aria-label','摄像头骨架与有效操偶区预览');
    this.canvas.setAttribute('aria-label','镜像摄像头画面，绿色框为有效操偶区，红点为捏合指尖');
    const caption=document.createElement('p');caption.textContent='镜像预览 · 绿框内操偶 · D 隐藏';
    this.root.append(this.canvas,caption);stage.append(this.root);
    this.toggle.type='button';this.toggle.setAttribute('aria-controls',this.root.id);panel.append(this.toggle);
    this.metrics.className='gesture-metrics';this.metrics.setAttribute('aria-label','手势实时诊断');
    panel.append(this.metrics);this.updateMetrics(null);
    const options={signal:this.events.signal};
    this.toggle.addEventListener('click',()=>this.toggleVisibility(),options);
    window.addEventListener('keydown',event=>{
      if(event.code!=='KeyD'||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
      const target=event.target as HTMLElement|null;
      if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName??''))return;
      this.toggleVisibility();
    },options);
    this.refresh();
  }
  setEnabled(enabled: boolean):void {this.enabled=enabled;this.refresh();}
  setPanelVisible(visible:boolean):void {this.panelVisible=visible;this.refresh();}
  private toggleVisibility():void {if(this.enabled){this.collapsed=!this.collapsed;this.refresh();}}
  private refresh():void {
    this.root.hidden=!this.panelVisible||!this.enabled||this.collapsed;this.toggle.hidden=!this.enabled;
    this.metrics.hidden=this.root.hidden;
    this.toggle.textContent=this.collapsed?'显示摄像头预览 (D)':'隐藏摄像头预览 (D)';
    this.toggle.setAttribute('aria-expanded',String(this.enabled&&!this.collapsed));
  }
  draw(video: HTMLVideoElement,landmarks?: readonly Landmark[]):void {
    if(!this.root.hidden)drawGesturePreview(this.canvas,video,landmarks);
  }
  updateMetrics(data:GestureDiagnostics|null):void {
    const xy=(p:{x:number;y:number})=>`${p.x.toFixed(1)}, ${p.y.toFixed(1)}`;
    this.metrics.textContent=data?`4↔8 距离：${data.distance.toFixed(4)}\n捏合：${data.pinched?'是':'否'}  抓取：${data.grabbing?'是':'否'}\n${data.neutralRequired?'等待张开手':`距离 <${config.pinch.close} 抓取 / >${config.pinch.open} 松开`}\n原始映射：${xy(data.raw)}\n滤波后：${xy(data.filtered)}\n死区后：${xy(data.stable)}\n坐标单位：舞台逻辑 px`:'未检测到手 · 等待中\n4↔8 距离：—  抓取：否';
    if(data)this.metrics.textContent+=data.target?`\n距目标圆心：${data.target.distance.toFixed(1)} px\n容错半径：${data.target.radius} px\n充能：${Math.round(data.target.progress*100)}%`:'\n距目标圆心：—（未捕获停留节点）';
  }
  clear():void {if(!this.root.hidden)drawGesturePreview(this.canvas,null);}
  dispose():void {this.events.abort();this.root.remove();this.toggle.remove();this.metrics.remove();}
}
