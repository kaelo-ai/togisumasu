// Figures are drawn from specs. Cropped paper images are not served.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const diagrams = require('../diagrams.js');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-fig-'));
process.env.QUESTION_SEED_PER_SKILL = '1';

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

function figure(file, id) {
  const paper = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'nsc', 'papers', file), 'utf8'));
  return paper.figures.find(item => item.id === id);
}

t('a function graph is an svg path and not a cropped image', () => {
  const fig = figure('2024-nov-p1.json', '2024-nov-p1-fig-5');
  const svg = diagrams.render(fig);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<path/);
  assert.match(svg, /\(0 ; 1\)/);
  assert.doesNotMatch(svg, /<img/);
  assert.doesNotMatch(svg, /\.png/);
  assert.equal(diagrams.evalPlain(fig.spec.functions[1].plain, 4), 1);
});

t('a Euclidean diagram is drawn from points and segments', () => {
  const fig = figure('2024-nov-p2.json', '2024-nov-p2-fig-9');
  const svg = diagrams.render(fig);
  assert.match(svg, /<svg/);
  assert.match(svg, /<circle/);
  for (const label of ['A', 'B', 'C', 'D', 'E']) assert.match(svg, new RegExp('>' + label + '<'));
  assert.doesNotMatch(svg, /<img|\.png/);
});

t('a scatter plot uses the spec points', () => {
  const fig = figure('2024-nov-p2.json', '2024-nov-p2-fig-1');
  const svg = diagrams.render(fig);
  assert.match(svg, /Weight/);
  assert.match(svg, /<circle/);
  assert.doesNotMatch(svg, /<img|\.png/);
});

const { server, db } = require('../server.js');
const quiz = require('../quiz.js');

t('a served question draws its figure instead of linking the crop', () => {
  const row = db.prepare(`SELECT id FROM nsc_nodes WHERE figure_ids LIKE '%2024-nov-p1-fig-5%' LIMIT 1`).get();
  assert.ok(row);
  const leaf = db.prepare(`SELECT id FROM nsc_nodes WHERE parent_id = ? AND is_leaf = 1 ORDER BY ord LIMIT 1`).get(row.id)
    || row;
  const html = quiz.promptHtml(db, leaf.id);
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /<img|\.png|figures\//);
});

const failed = results.filter(row => row[0] === 'FAIL');
for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
server.close();
process.exit(failed.length ? 1 : 0);
