// 源图像素坐标；部件纹理共用整张 PNG，通过多边形遮罩裁出可见区域。
export const rigConfig = {
  houyi: {
    url: '/assets/houyi.png', textureSize: { width: 1024, height: 1536 },
    scale: 0.55, origin: { x: 500, y: 1225 },
    shoulder: { x: 630, y: 650 }, elbow: { x: 746, y: 660 }, hand: { x: 904, y: 657 },
    rest: { shoulder: -0.12, elbow: -0.10 },
    bodyHoles: [[285,1226,337,1134,441,1177,557,1176,590,1115,697,1112,746,1226]],
    limits: { shoulder: [-Math.PI, Math.PI], elbow: [-Math.PI, Math.PI] },
    body: { pivotOffset: { x: 500, y: 1225 }, baseRotation: 0,
      polygon: [173,1228,174,1208,215,1187,237,1128,245,1040,73,1038,160,955,75,930,92,859,248,822,185,780,177,717,288,681,292,630,450,605,300,562,372,528,367,484,501,476,551,457,610,478,641,530,625,590,597,617,633,624,649,651,632,682,610,748,655,839,735,876,762,936,839,950,914,1006,910,1068,850,1011,761,1002,774,1070,815,1164,864,1203,862,1229,752,1229,723,1162,700,1100,589,1107,556,1171,443,1171,341,1128,280,1165,280,1228,173,1228] },
    upperArm: { pivotOffset: { x: 630, y: 650 }, baseRotation: Math.PI / 2 - Math.atan2(10,116),
      polygon: [609,641,622,624,650,624,687,640,737,641,762,647,763,671,739,684,684,683,639,671,614,667] },
    forearm: { pivotOffset: { x: 746, y: 660 }, baseRotation: Math.PI / 2 - Math.atan2(-3,158),
      polygon: [729,640,753,629,782,639,837,644,864,636,909,616,944,613,944,626,917,640,946,638,963,645,961,653,929,650,951,666,944,674,916,660,922,682,911,686,893,669,855,677,809,684,770,694,738,681] },
  },
  queen: {
    url: '/assets/queen.png', textureSize: { width: 1024, height: 1536 },
    scale: 0.53, origin: { x: 500, y: 1030 },
    body: { pivotOffset: { x: 500, y: 1030 }, baseRotation: 0,
      polygon: [310,1427,343,1395,372,1345,369,1265,333,1200,337,1109,369,1019,378,982,356,974,333,970,328,948,349,949,345,927,358,921,374,944,387,968,435,979,469,943,468,915,455,908,469,890,450,870,437,838,458,807,489,788,524,805,541,831,541,876,527,922,529,947,581,944,627,965,654,988,649,1014,626,1056,648,1113,638,1150,615,1168,589,1149,601,1207,641,1259,615,1299,624,1338,691,1337,736,1351,764,1359,734,1376,684,1369,662,1385,710,1403,751,1424,724,1438,661,1440,593,1438,520,1429,477,1438,430,1438,393,1417,353,1428] },
    handOffset: { x: 353, y: 955 },
    bodyHoles: [[578,971,610,977,632,995,608,1026,581,1034], [600,1083,630,1115,625,1141,606,1148,587,1124]],
    floatAmplitude: 4, floatPeriod: 5,
    armLimits: { min: -Math.PI / 6, max: Math.PI / 4 },
  },
  targetBounds: { minX: 0, maxX: 1920, minY: 0, maxY: 1080 },
  resetSeconds: 0.45,
} as const;

export const armLengths = {
  upper: Math.hypot(rigConfig.houyi.elbow.x-rigConfig.houyi.shoulder.x, rigConfig.houyi.elbow.y-rigConfig.houyi.shoulder.y)*rigConfig.houyi.scale,
  lower: Math.hypot(rigConfig.houyi.hand.x-rigConfig.houyi.elbow.x, rigConfig.houyi.hand.y-rigConfig.houyi.elbow.y)*rigConfig.houyi.scale,
};
