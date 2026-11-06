export interface StagePoint { x: number; y: number }

// 所有输入源统一使用舞台逻辑坐标。摄像头适配器只需派发相同的三个事件。
export type SemanticInput =
  | { type: 'GRAB'; point: StagePoint }
  | { type: 'MOVE'; point: StagePoint }
  | { type: 'RELEASE'; cancelled?: boolean };

export type InputSink = (event: SemanticInput) => void;
