import type { InputSink, StagePoint } from './semantic.ts';

export type GestureInput =
  | { type: 'GRAB_START'; point: StagePoint }
  | { type: 'CONTROL_UPDATE'; delta: StagePoint; motionPoint?: StagePoint }
  | { type: 'GRAB_END'; cancelled?: boolean };

// 兼容现有剧情接口；状态机和动画完全不依赖摄像头/MediaPipe。
export function bridgeGestureInput(send: InputSink): (event: GestureInput) => void {
  let origin:StagePoint|null=null;
  return event => {
    if (event.type === 'GRAB_START') {origin={...event.point};send({ type: 'GRAB', point: event.point });}
    else if (event.type === 'CONTROL_UPDATE') {
      if(origin)send({ type: 'MOVE', point: {x:origin.x+event.delta.x,y:origin.y+event.delta.y},
        ...(event.motionPoint?{motionPoint:event.motionPoint}:{}) });
    } else {origin=null;send({ type: 'RELEASE', cancelled: event.cancelled });}
  };
}
