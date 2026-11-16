// 第一幕单节点试运行；坐标为镜像摄像头画面 -> 1920 × 1080 舞台。
export const gestureConfig = {
  stage: { width: 1920, height: 1080 },
  mirrorX: true,
  roi: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }, // 镜像画面中央60%，归一化坐标
  preview: { width: 320, height: 240 },
  pinch: { close: 0.28, open: 0.42, confirmMs: 65 }, // 指尖距离 / 掌宽
  lostHandMs: 500,
  filter: { minCutoff: 1.5, beta: 0.015, derivativeCutoff: 1 },
  inferenceFps: 24,
  startupTimeoutMs: 20000,
  wasmPath: '/mediapipe/wasm',
  modelPath: '/mediapipe/hand_landmarker.task',
};
