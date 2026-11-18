// 三幕共用输入；坐标为镜像摄像头活动区 -> 1920 × 1080 舞台。
export const gestureConfig = {
  stage: { width: 1920, height: 1080 },
  mirrorX: true,
  roi: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }, // 镜像画面中央60%，归一化坐标
  preview: { width: 320, height: 240 },
  swallow: { liftDistance: 180 }, // 手部向上移动180舞台像素，完成第二幕抬臂
  pinch: { close: 0.1, open: 0.15 }, // hypot(dx * 视频宽高比, dy)，以视频高度为单位
  deadzonePx: 2, // 1920×1080逻辑像素，累计位移超过死区才更新
  lostHandMs: 500,
  filter: { minCutoff: 1.0, beta: 0.007, derivativeCutoff: 1 },
  inferenceFps: 24,
  startupTimeoutMs: 20000,
  wasmPath: '/mediapipe/wasm',
  modelPath: '/mediapipe/hand_landmarker.task',
};
