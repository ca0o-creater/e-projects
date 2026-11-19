// 坐标/速度：1920×1080 逻辑像素、像素/秒；时间：秒。
export const actOneConfig = {
  stage: { width: 1920, height: 1080 },
  colors: {
    background: '#e6c995', paperEdge: '#886945', lamplight: '#fff0c4',
    shadow: '#3f251c', frame: '#492f27', gold: '#ae8956',
    mountains: ['#536d7e', '#304f68', '#19364f'], ridge: '#9aafad',
    title: '#59422c', seal: '#864432',
  },
  // 云、山及其投影均不进入此区域（题字仅在开场短暂出现）。
  operationArea: { x: 270, y: 300, width: 1380, height: 750 },
  light: { centerX: 960, centerY: 550, radiusX: 920, radiusY: 690,
    alpha: 0.72, breathAmplitude: 0.025, breathPeriod: 8, blur: 28 },
  shadows: { offsetX: 10, offsetY: 14, alpha: 0.30, blur: 10 },
  mountains: { edgeWidth: 210, heightScale: 0.42, roughness: 3.5 },
  grain: { noise: 0.035, seed: 0.37 },
  clouds: [
    { speed: 5, color: '#6e899c', alpha: 0.38, y: 85, scale: 1.5 },
    { speed: 10, color: '#a8bac3', alpha: 0.48, y: 130, scale: 1.25 },
    { speed: 16, color: '#e0e8df', alpha: 0.60, y: 182, scale: 1.0 },
  ],
  title: { text: '昆仑山门，后羿求药', fontFamily: ['STKaiti', 'KaiTi', 'FangSong', 'serif'],
    fontSize: 72, startY: -130, endY: 350, delay: 1.2, enter: 2.8, hold: 2, exit: 1.8 },
} as const;
