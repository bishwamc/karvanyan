// Content lint (v4 spec 11.4). Run: node tools/lint-content.mjs
// Fails (exit 1) on: banned game-jargon in player text, paragraphs over 45 words, missing ids, images without alt text.
import { loadGame } from './simulate.mjs';

const BANNED = [
  [/\bLU\b/, 'LU'], [/load units?/i, 'load units'], [/\bHP\b/, 'HP'], [/\bx\d+(\.\d+)?\b/, 'xN multiplier'],
  [/multiplier/i, 'multiplier'], [/\+\d+ points/i, '+N points'], [/\bstats?\b/i, 'stat'], [/\bbuff\b|\bdebuff\b/i, 'buff/debuff'],
  [/\bRNG\b/, 'RNG'], [/\bverify\b/i, 'verify'], [/\bin place of\b/i, 'in place of'],
];
const MAX_WORDS = 45;
const problems = [];
const report = (where, message) => problems.push(`${where}: ${message}`);

function checkText(where, text, { checkLength = true } = {}) {
  if (typeof text !== 'string') return;
  BANNED.forEach(([pattern, name]) => { if (pattern.test(text)) report(where, `banned term "${name}" in "${text.slice(0, 60)}"`); });
  if (checkLength && text.split(/\s+/).filter(Boolean).length > MAX_WORDS) report(where, `paragraph over ${MAX_WORDS} words: "${text.slice(0, 50)}..."`);
}

const { Content, Story, World } = loadGame();

Object.entries(Content.COPY).forEach(([key, value]) => checkText(`copy.${key}`, value));
Content.CANDIDATES.forEach((c) => { checkText(`candidate.${c.id}.strength`, c.strengthText); checkText(`candidate.${c.id}.flaw`, c.flawText); checkText(`candidate.${c.id}.line`, c.line); });

const allStorylets = [...Content.STORYLETS, ...Story.STORYLETS];
const ids = new Set();
allStorylets.forEach((s) => {
  if (ids.has(s.id)) report(`storylet.${s.id}`, 'duplicate id');
  ids.add(s.id);
  (s.text || []).forEach((paragraph, index) => checkText(`storylet.${s.id}.text[${index}]`, paragraph));
  (s.choices || []).forEach((choice) => { checkText(`storylet.${s.id}.${choice.id}.label`, choice.label, { checkLength: false }); checkText(`storylet.${s.id}.${choice.id}.result`, choice.result); });
  if (s.imageId && !Content.IMAGE_ALT[s.imageId]) report(`storylet.${s.id}`, `image ${s.imageId} has no alt text`);
});

Story.LETTERS.forEach((letter) => {
  if (!World.findNode(letter.stopId)) report(`letter.${letter.id}`, `stop ${letter.stopId} does not exist`);
  letter.paragraphs.forEach((paragraph, index) => checkText(`letter.${letter.id}[${index}]`, paragraph));
});
Story.CHAPTERS.forEach((chapter) => {
  if (!World.findNode(chapter.endNodeId)) report(`chapter.${chapter.number}`, `end node ${chapter.endNodeId} does not exist`);
  chapter.learned.forEach((line, index) => checkText(`chapter.${chapter.number}.learned[${index}]`, line));
});
Object.values(Story.GAP_LINES).forEach((line, index) => checkText(`gapLine[${index}]`, line));
Story.COACH_NOTE_IDS.forEach((id) => { if (!Content.COPY[`coach.${id}`]) report(`coachNote.${id}`, 'no copy key coach.' + id); });
World.NODES.forEach((node) => { if (!Content.IMAGE_ALT[`stop_${node.id}`]) report(`stop.${node.id}`, 'no alt text'); });

if (problems.length) { console.error(`${problems.length} content problem(s):\n` + problems.map((line) => ` - ${line}`).join('\n')); process.exit(1); }
console.log('Content lint passed.');
