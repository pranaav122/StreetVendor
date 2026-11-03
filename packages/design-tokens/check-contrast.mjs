import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const { color, control } = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

for (const [foreground, background] of [
  ['text', 'background'], ['text', 'surface'], ['muted', 'surface'],
  ['muted', 'background'], ['onPrimary', 'primary'], ['danger', 'surface'],
  ['primary', 'subtle'],
]) {
  const values = [luminance(color[foreground]), luminance(color[background])].sort((a, b) => a - b);
  const ratio = (values[1] + 0.05) / (values[0] + 0.05);
  assert.ok(ratio >= 4.5, `${foreground}/${background} fails normal-text contrast`);
  console.log(`${foreground}/${background}: ${ratio.toFixed(2)}:1`);
}
assert.ok(control.minHeight >= control.minTouch && control.minTouch >= 48);
console.log('Seven text contrast pairs and minimum touch dimensions passed.');
