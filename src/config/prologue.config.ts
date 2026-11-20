// 序章（Prologue）：第一幕之前、宣纸舞台上的逐句旁白与后羿走向山门的入场。
// 背景沿用第一幕的米黄宣纸、暖光与两侧山峦；序章另外绘制山门剪影与行走的后羿。
// 坐标为 1920×1080 舞台逻辑像素；时间单位为秒。
export const prologueConfig = {
  stage: { width: 1920, height: 1080 },
  audio: {
    // 仓库当前提供的是 WAV；若换成 MP3，只需修改这里的两个 URL。
    sources: {
      intro: '/audio/intro_voice.wav',
      journey: '/audio/journey_voice.wav',
    },
    introGapMs: 1500,
    endingGapMs: 2000,
  },
  colors: {
    text: '#3e2723', // 深褐色，压在米黄宣纸上有足够对比度。
    shadow: '#2a1a12',
    backdrop: '#2a1a12',
  },
  subtitle: {
    fontFamily: ['STKaiti', 'KaiTi', 'FangSong', 'serif'],
    fontSize: 40,
    lineHeight: 64,
    letterSpacing: 5,
    maxWidth: 960,
    // 文字放在画面左侧上方，右侧留给山门和走进山门的后羿。
    x: 580,
    y: 340,
    // 每句依次淡入 in、停留 hold、淡出 out；句与句之间留 gap。
    in: 0.9,
    hold: 2.6,
    out: 0.8,
    gap: 0.4,
    // 柔和深色投影，压住宣纸纹理与云纹边缘。
    shadow: { alpha: 0.35, blur: 6, distance: 2, angle: Math.PI / 2 },
    // 非常微弱的径向深色托底，只降低文字周围的亮度，不形成明显方框；末段随旁白淡出。
    backdrop: { width: 980, height: 300, alpha: 0.15, falloff: 0.55, fadeOut: 0.6 },
  },
  // 按句读断行，避免自动换行把“后羿”之类的词拆到两行；maxWidth 仍作为兜底。
  lines: [
    '远古之时，十日并出，民不聊生。\n神射手后羿射落九日，拯救苍生。',
    '然天命难违，后羿谪落凡间。\n为求长生，听闻昆仑山有西王母不死之药，\n遂跋山涉水，终至山门……',
  ],
  // 山门剪影：屏幕中偏右上方，门洞留空，后羿最后走进门洞。
  gate: { x: 1310, baseY: 655, width: 360, height: 420, color: '#4a3324', alpha: 0.5 },
  // 后羿行走图：原图带透明边和右下角水印，运行时按 crop 只取人物可见区域。
  houyiWalk: {
    url: '/assets/houyi_walk.png',
    crop: { x: 107, y: 368, width: 611, height: 964 },
    // 起点在左下角（人物高 440），终点在山门前缩到 30%（132）、透明度 0.5。
    start: { x: 210, y: 1010, height: 440, alpha: 1 },
    end: { x: 1310, y: 655, height: 132, alpha: 0.5 },
    // 走路起伏：旁白 9 秒里走 9 个上下周期，幅度随人物一起缩小。
    bob: { amplitude: 5, cycles: 9 },
  },
  // 旁白结束后整体暗场 0.5 秒，切到第一幕后再亮起。
  transition: { fadeToBlack: 0.5, fadeFromBlack: 0.5 },
  // 第一幕里后羿的待机呼吸；与序章行走无关，仅在切幕之后生效。
  houyi: { breath: { amplitude: 3, period: 4.5 } },
  skip: {
    label: '跳过序章',
    ariaLabel: '跳过序章，直接进入第一幕',
    appearAt: 0.4,
    right: '4%',
    bottom: '4%',
  },
  // 时长由上面的节奏推导：2 句 × 4.3 秒 + 1 个句间间隔 0.4 秒 = 9 秒旁白，再加 0.5 秒暗场。
  get lineDuration() { return this.subtitle.in + this.subtitle.hold + this.subtitle.out; },
  get step() { return this.lineDuration + this.subtitle.gap; },
  get duration() { return this.lines.length * this.lineDuration + (this.lines.length - 1) * this.subtitle.gap; },
  get total() { return this.duration + this.transition.fadeToBlack; },
} as const;
