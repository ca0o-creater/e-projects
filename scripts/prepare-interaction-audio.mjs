import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// 原始 WAV 不覆盖；按实测峰值调整，给混音叠加保留余量。
// 生成后由 AudioManager 加载 public/audio/mixed/。
const root = fileURLToPath(new URL('../public/audio/', import.meta.url));
const output = join(root, 'mixed');
mkdirSync(output, { recursive: true });
const gains = {
  'scene-enter': 22,
  'env-kunlun-loop': -8,
  'sfx-grab': 30,
  'sfx-drag-loop': 14,
  'sfx-catch': 16,
  'sfx-return': 23,
  'sfx-success': 4,
};
for (const [name, gain] of Object.entries(gains)) {
  // 两条循环素材实测首尾各有约 0.1 秒静音。去除空白并在循环接缝交叉淡化。
  // 循环周期因此分别变为 29.73 秒和 1.73 秒，原文件仍保留 30 秒/2 秒。
  const duration = name === 'env-kunlun-loop' ? 30 : name === 'sfx-drag-loop' ? 2 : null;
  const filter = duration === null
    ? ['-af', `volume=${gain}dB`]
    : ['-filter_complex', `[0:a]volume=${gain}dB,atrim=start=0.1:end=${duration - 0.13},asetpts=PTS-STARTPTS,asplit=2[a][b];` +
      `[a][b]acrossfade=d=0.04:c1=tri:c2=tri,atrim=start=${duration - 0.27}:end=${2 * (duration - 0.27)},asetpts=PTS-STARTPTS[out]`, '-map', '[out]'];
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', join(root, `${name}.wav`), ...filter,
    '-c:a', 'pcm_s16le', join(output, `${name}.wav`)], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
  console.log(`${name}: ${gain > 0 ? '+' : ''}${gain} dB`);
}
