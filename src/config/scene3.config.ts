export const scene3Config={
 stage:{width:1920,height:1080},introSeconds:2.5,
 background:{url:'/assets/scene3_bg.png',travel:420,extensionRegion:{x:0,y:0,width:800,height:175}},
 night:{top:0x07132f,bottom:0x294a78,startAlpha:0.08,endAlpha:0.72},
 watermarkCover:{x:1680,y:1010,width:240,height:70,color:0x172238,alpha:1},
 // scale 为原图骨架的实际缩放，不再乘其他幕的默认 scale；x 锁定腰部主杆。
 character:{x:755,startY:1000,endY:700,startScale:.2,endScale:.8,waist:{x:650,y:790},restProgress:.35},
 control:{radius:32,grabRadius:58,stroke:0xffe8b4,holdSeconds:.4,stableRadius:60,threshold:.95,assistSpeed:.13},
 rod:{color:0x302728,width:4,footOffsetX:40},
 moon:{x:1040,y:230,radius:150,startScale:.55,endScale:1.4,startAlpha:.2,endAlpha:1,color:0xfff2cb,halo:0xb5d9ef},
 ending:{flightSeconds:2.4,pulseSeconds:.8,get duration(){return this.flightSeconds+this.pulseSeconds;},
   shrinkFactor:.8,center:{x:500,y:850},pulseScale:.12,pulseGlow:.7},
 video:{url:'/assets/ending_cry.mp4',targetSeconds:4,startupTimeoutMs:6000,stallTimeoutMs:4000,maxPlaybackMs:30000,
   fadeMs:700,captionText:'清冷月宫，相思无尽',captionDelayMs:700,captionVoiceSeconds:3,buttonsDelayMs:1600,background:'#343b49'},
 title:{x:960,y:140,size:52,color:0xffe7be},
 caption:{x:960,y:810,size:46,color:0xe4edf7},
 review:['后羿得药：昆仑求药，完成交接。','嫦娥吞药：逢蒙逼药，嫦娥护药。','奔月相思：嫦娥升入月宫，后羿留在人间。','皮影操演：通过影杆带动关节，借幕布透光呈现人物。'],
} as const;
