process.env.AI_PROVIDER = 'mock';
const { debugSplitVivaPoints, debugScoreViva } = await import('../src/services/aiService.js');

const sample =
  'General: Middle-aged male, fully conscious, cooperative. Mild periorbital puffiness is visible bilaterally. No pallor, icterus, or cyanosis. Neck: Supple, neck veins (JVP) are normal and not elevated (estimated at 2 cm above sternal angle at 45 degrees, ruling out right heart failure). Legs: Massive, symmetrical bilateral swelling extending from the dorsum of both feet up to the mid-thighs. The skin over the swollen area is smooth, pale, stretched, and shiny. No localized redness, pigmentation, or varicose veins.';

const points = debugSplitVivaPoints(sample);
console.log('POINTS', points.length);
points.forEach((p, i) => console.log(`${i + 1}. ${p}`));

const base = ['puffy eyes', 'there is lower limb edema'].join('\n');
console.log('\nBASE', debugScoreViva(base, sample));

for (const a of [
  'no pallor no cyanosis no jaundice',
  'No pallor or cyanosis or jaundice',
  'JVP is normal',
  'neck veins are normal',
  'skin is smooth pale stretched and shiny',
  'smooth pale stretched shiny skin',
  'no redness no varicose veins',
  'no localized redness pigmentation or varicose veins',
]) {
  const alone = debugScoreViva(a, sample);
  const cum = debugScoreViva(`${base}\n${a}`, sample);
  console.log(`\nTRY: ${a}`);
  console.log(' alone matched:', alone.matched.map((m) => m.slice(0, 80)));
  console.log(
    ' newly vs base:',
    cum.matched.filter((m) => !debugScoreViva(base, sample).matched.includes(m)).map((m) => m.slice(0, 80)),
  );
  console.log(' still missing:', cum.missing.map((m) => m.slice(0, 90)));
}
