import { actOneConfig } from './act-one.ts';
import { rigConfig, armLengths } from './rig.config.ts';

const title = actOneConfig.title;
const titleEnd = title.delay + title.enter + title.hold + title.exit;

// 后羿在第一幕开场即在台上（序章另有独立的行走图），appearAt/fadeDuration 为 0。
// 西王母仍在题字结束后入场，人物入场时间随题字时长自动顺延。
export const charactersConfig = {
  ink: '#241b18', shadow: { color: '#40251c', x: 4, y: 9, alpha: 0.34, blur: 4 },
  layers: { houyi: 10, queen: 20, bottle: 30 },
  houyi: {
    x: 700, y: 920, scale: 1.05, appearAt: 0, fadeDuration: 0,
    torso: { x: 0, y: -235, z: 10 }, head: { x: 8, y: -315, z: 20 },
    shoulder: { x: (rigConfig.houyi.shoulder.x-rigConfig.houyi.origin.x)*rigConfig.houyi.scale,
      y: (rigConfig.houyi.shoulder.y-rigConfig.houyi.origin.y)*rigConfig.houyi.scale, z: 30 },
    upperArm: { width: 30, length: armLengths.upper, rotation: rigConfig.houyi.rest.shoulder },
    forearm: { width: 23, length: armLengths.lower, rotation: rigConfig.houyi.rest.elbow },
  },
  queen: { x: 1260, y: 360, startY: 230, scale: 1,
    appearAt: titleEnd + 1.7, enterDuration: 3, palm: { x: -169, y: 30 },
    head: { x: 0, y: -70, z: 20 }, torso: { x: 0, y: 0, z: 10 } },
  bottle: { radius: 17, haloRadius: 42, color: '#fff5bf', haloColor: '#ffc85f',
    pulsePeriod: 2.6, glowAlpha: 0.55, pulseAmplitude: 0.15, glowFadeDuration: 0.8 },
  interactionDelayAfterArrival: 0.8,
} as const;

export const actOneIntroEnd = Math.max(
  charactersConfig.houyi.appearAt + charactersConfig.houyi.fadeDuration,
  charactersConfig.queen.appearAt + charactersConfig.queen.enterDuration,
) + charactersConfig.interactionDelayAfterArrival;
