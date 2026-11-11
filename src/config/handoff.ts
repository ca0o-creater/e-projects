// 坐标与容错半径均为 1920×1080 的舞台逻辑像素；时间单位秒，角度单位弧度。
export const handoffConfig = {
  offering: { duration: 1.6, startAngle: -0.34, endAngle: 0.08 },
  controlPoints: [{ x: 1170, y: 405 }, { x: 920, y: 510 }],
  grabRadius: 65,
  snapRadius: 100,
  snapMinProgress: 0.97,
  snapDuration: 0.5,
  returnDuration: 1.1,
  retractDuration: 1.2,
  trail: { count: 14, lifetime: 0.38, interval: 0.025, radius: 18 },
  success: { color: '#fff0ad', radius: 125 },
} as const;
