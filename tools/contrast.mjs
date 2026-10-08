/**
 * tools/contrast.mjs — WCAG contrast checker for the colour tokens in css/style.css.
 * Usage: node tools/contrast.mjs
 * Text pairs need 4.5:1; borders and focus rings need 3:1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'css', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

/** Extracts `--name: #hex;` declarations from the first block matching `selectorStart`. */
function readTokens(selectorStart) {
  const start = css.indexOf(selectorStart);
  const end = css.indexOf('}', start);
  const tokens = {};
  for (const match of css.slice(start, end).matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[match[1]] = match[2];
  return tokens;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes = { light: readTokens(':root {'), dark: readTokens(':root[data-theme="dark"] {') };

// The dark tokens are written twice in the CSS (OS preference and manual choice). They must match.
const darkFromMediaQuery = readTokens('@media (prefers-color-scheme: dark)');
let failures = 0;
Object.keys(themes.dark).forEach((name) => {
  if (darkFromMediaQuery[name] !== themes.dark[name]) {
    failures += 1;
    console.log(`FAIL dark token --${name} differs: data-theme ${themes.dark[name]} vs media query ${darkFromMediaQuery[name]}`);
  }
});
const checks = [
  ['text', 'background', 4.5], ['text', 'surface', 4.5], ['text', 'surface-raised', 4.5],
  ['text-muted', 'surface', 4.5], ['text-muted', 'surface-raised', 4.5], ['text-muted', 'background', 4.5],
  ['on-primary', 'primary', 4.5], ['on-danger', 'danger', 4.5],
  ['primary', 'surface', 4.5], ['danger', 'surface', 4.5], ['warning', 'surface', 4.5], ['safe', 'surface', 3],
  ['rule', 'surface', 4.5], ['rule', 'background', 4.5], ['border', 'surface', 3], ['border', 'background', 3], ['focus', 'background', 3], ['focus', 'surface', 3],
];

Object.entries(themes).forEach(([themeName, tokens]) => {
  console.log(`\n${themeName} theme`);
  checks.forEach(([foreground, background, minimum]) => {
    const value = ratio(tokens['color-' + foreground], tokens['color-' + background]);
    const passes = value >= minimum;
    if (!passes) failures += 1;
    console.log(`${passes ? 'PASS' : 'FAIL'} ${foreground} on ${background}: ${value.toFixed(2)} (need ${minimum})`);
  });
});
process.exit(failures === 0 ? 0 : 1);
