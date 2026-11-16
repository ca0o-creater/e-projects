import {changeArm, changeRigConfig} from './change-rig.ts';
// 两位对峙人物统一缩至原来的 65%；不改变其他幕的骨架原图参数。
const characterScale=0.65;
const changE={x:920,y:980,scale:0.66*characterScale,flipX:true};
const facing=changE.flipX?-1:1;
const stageArmAngle=(angle:number)=>changE.flipX?Math.PI-angle:angle;
// 第二幕使用 1920×1080 舞台坐标。时间单位为秒，角度为弧度。
export const scene2Config = {
  stage: { width: 1920, height: 1080 },
  // x/y 指翻转后的图片左上角；固定构图，不使用 cover 自动铺满。
  background: {url:'/assets/scene2_bg.png',scale:1.3,x:-150,y:80,flipX:true,nightOpacity:0.4},
  moon: {x:1730,y:40,radius:30,color:'#fff0bc',hitRadius:75,fadeSeconds:1.2,
    haloRadius:52,haloAlpha:0.35,skyHitHeight:140},
  captions: {title:{x:960,y:150},intro:{x:960,y:215},warning:{x:960,y:40},
    warningText:'逢蒙持刀逼迫，嫦娥护药'},
  colors: { background: '#2d2728', courtyard: '#463832', light: '#9a805d', ink: '#201b20',
    changE: '#754839', trim: '#c8a36a', glow: '#ffe3a0', caption: '#f5dfb6' },
  intro: { get duration() { return this.approachStart+this.approachDuration+this.warningHold+this.warningFade; },
    departureStart: 0.6, departureDuration: 3.8, departureGap: 0.35,
    get approachStart() { return this.departureStart+this.departureDuration+this.departureGap; },
    approachDuration: 4.4,
    warningHold: 2.2, warningFade: 0.6 },
  changE,
  characterScale,
  shadow:{radiusX:150*characterScale,radiusY:21*characterScale},
  rods:{bodyFootOffsetX:-50*characterScale*facing,bodyOffsetX:-10*characterScale*facing,
    bodyOffsetY:-180*characterScale,handFootOffsetX:225*characterScale*facing},
  departingHouyi: { startX:530,endX:-330,y:980,scale:0.9,offstageMargin:40,fadeInSeconds:0.35 },
  pengMeng: { url:'/assets/fengmeng.png', startX:-40,endX:700,y:980,height:455*characterScale,flipX:true,
    walkAmplitude:4,walkHz:1.8,
    safeGap:80, jitterAmplitude:1.5, jitterHz:2.5,
    // 当前附件有纸底：以 288×384 原图坐标裁轮廓；换成透明PNG时改成false。
    usePaperMask:true, referenceSize:{width:288,height:384}, origin:{x:29,y:377}, visibleHeight:347,
    silhouette:[29,155,32,143,44,138,58,148,101,173,137,136,136,118,148,114,
      149,94,137,92,128,109,113,145,117,116,108,112,115,102,110,97,120,88,
      111,78,113,60,106,52,108,44,116,43,122,49,120,58,130,59,139,40,
      154,29,172,45,170,63,158,82,194,128,181,132,166,104,173,135,
      227,152,240,161,237,194,230,225,225,238,232,242,229,251,
      278,321,278,331,267,320,219,253,216,257,208,247,214,235,
      187,235,194,271,207,307,237,349,211,354,217,374,181,377,
      179,364,189,358,173,313,159,291,143,357,129,354,128,374,99,373,
      97,362,109,356,95,348,108,322,127,294,122,282,139,260,145,227,
      139,218,142,196,137,172,112,192,102,197,89,193,51,165,33,161],
    holes:[[177,169,218,175,214,224,197,204],[182,184,206,225,188,225],
      [151,91,157,89,179,124,171,120]],
  },
  tension: { x:790,y:700,radiusX:220,radiusY:290,color:'#a02c26',alpha:0.1 },
  arm: { center: {
      x:changE.x+(changeRigConfig.elbow.x-changeRigConfig.origin.x)*changE.scale*facing,
      y:changE.y+(changeRigConfig.elbow.y-changeRigConfig.origin.y)*changE.scale},
    radius:Math.hypot(changeRigConfig.palm.x-changeRigConfig.elbow.x,changeRigConfig.palm.y-changeRigConfig.elbow.y)*changE.scale,
    // 反射整条弧线，而非只移动控制圈；保留连续角域，跨 ±π 时拖动仍连续。
    startAngle: stageArmAngle(changeArm.startAngle), endAngle: stageArmAngle(changeArm.endAngle),
    grabRadius: 48, controlRadius: 29, targetProgress: 0.9, holdSeconds: 0.4,
    stillRadius: 8, centerDeadZone: 18, returnSeconds: 0.85 },
  ending: { swallowSeconds: 1.3, riseSeconds: 3, riseHeight: 220 },
} as const;
