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

t('a point on a side is drawn on that side, so the proportionality figure has ST parallel to QR', () => {
  const svg = diagrams.render(figure('2016-nov-p2.json', '2016-nov-p2-fig-10.1'));
  const at = {};
  const dots = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="2.2"/g)].map(m => ({ x: +m[1], y: +m[2] }));
  const labels = [...svg.matchAll(/<text[^>]*>([A-Z])<\/text>/g)].map(m => m[1]);
  labels.forEach((label, i) => { at[label] = dots[i]; });
  // distance in pixels from c to the line ab, and the sine of the angle between two directions
  const cross = (a, b, c) => ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(Math.abs(cross(at.P, at.Q, at.S)) < 2, 'S lies on PQ');
  assert.ok(Math.abs(cross(at.P, at.R, at.T)) < 2, 'T lies on PR');
  const st = { x: at.T.x - at.S.x, y: at.T.y - at.S.y }, qr = { x: at.R.x - at.Q.x, y: at.R.y - at.Q.y };
  assert.ok(Math.abs(st.x * qr.y - st.y * qr.x) / Math.hypot(st.x, st.y) / Math.hypot(qr.x, qr.y) < 0.01, 'ST is parallel to QR');
});

t('a point given on a side sits on that side and the circle passes through the vertices', () => {
  const svg = diagrams.render(figure('2025-nov-p2.json', '2025-nov-p2-fig-10'));
  const dots = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="2.2"/g)].map(m => ({ x: +m[1], y: +m[2] }));
  const labels = [...svg.matchAll(/<text[^>]*>([A-Z])<\/text>/g)].map(m => m[1]);
  const at = Object.fromEntries(labels.map((label, i) => [label, dots[i]]));
  const off = ((at.R.x - at.S.x) * (at.V.y - at.S.y) - (at.R.y - at.S.y) * (at.V.x - at.S.x)) / Math.hypot(at.R.x - at.S.x, at.R.y - at.S.y);
  assert.ok(Math.abs(off) < 1, 'V lies on SR');
  const ring = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="none"/);
  for (const label of 'PQRST') assert.ok(Math.abs(Math.hypot(at[label].x - ring[1], at[label].y - ring[2]) - ring[3]) < 1, label + ' is on the circle');
});

t('a bar chart over months draws its bars and never writes NaN into the svg', () => {
  const svg = diagrams.render(figure('2020-nov-p2.json', '2020-nov-p2-fig-2'));
  assert.doesNotMatch(svg, /NaN|Infinity/);
  assert.equal((svg.match(/<rect /g) || []).length, 12);
  assert.match(svg, />Apr</);
});

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
