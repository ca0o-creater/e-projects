// 第二幕使用 1920×1080 舞台坐标。时间单位为秒，角度为弧度。
export const actTwoConfig = {
  stage: { width: 1920, height: 1080 },
  colors: { background: '#38302e', courtyard: '#55463d', light: '#b39769', ink: '#201b20',
    changE: '#754839', trim: '#c8a36a', glow: '#ffe3a0', caption: '#f5dfb6' },
  intro: { duration: 8, departureStart: 1, departureDuration: 2.4, approachStart: 3.6, approachDuration: 3.4 },
  changE: { x: 720, y: 860, shoulder: { x: 735, y: 555 }, face: { x: 772, y: 485 } },
  pengMeng: { startX: 1680, endX: 1230, y: 865 },
  arm: { center: { x: 780, y: 600 }, radius: 105, startAngle: 1.1, endAngle: -1.65,
    grabRadius: 48, controlRadius: 29, targetProgress: 0.9, holdSeconds: 0.4,
    stillRadius: 8, centerDeadZone: 18, returnSeconds: 0.85 },
  ending: { swallowSeconds: 1.3, riseSeconds: 3, riseHeight: 220 },
} as const;
