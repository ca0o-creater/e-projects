import type { InputSink, StagePoint } from './semantic.ts';

export type GestureInput =
  | { type: 'GRAB_START'; point: StagePoint }
  | { type: 'CONTROL_UPDATE'; point: StagePoint }
  | { type: 'GRAB_END'; cancelled?: boolean };

// 兼容现有剧情接口；状态机和动画完全不依赖摄像头/MediaPipe。
export function bridgeGestureInput(send: InputSink): (event: GestureInput) => void {
  return event => {
    if (event.type === 'GRAB_START') send({ type: 'GRAB', point: event.point });
    else if (event.type === 'CONTROL_UPDATE') send({ type: 'MOVE', point: event.point });
    else send({ type: 'RELEASE', cancelled: event.cancelled });
  };
}
