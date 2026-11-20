// Euclidean answers are an ordered statement + reason chain, marked without a model.
'use strict';
const assert = require('node:assert/strict');
const core = require('../public/core.js');
const questions = require('../questions.js');
const keys = require('../keys.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const proof = {
  type: 'geom',
  prompt: 'Prove the two sides are equal.',
  steps: ['OA and OB are both radii.', 'The base angles of an isosceles triangle are equal.'],
  statements: [
    { id: 's1', text: 'OA = OB' },
    { id: 's2', text: 'angle OAB = angle OBA' },
    { id: 's3', text: 'AB is a diameter' },
  ],
  reasons: [
    { id: 'r1', text: 'radii' },
    { id: 'r2', text: 'angles opposite equal sides' },
    { id: 'r3', text: 'tan-chord theorem' },
  ],
  chain: [
    { statement: 's1', reason: 'r1' },
    { statement: 's2', reason: 'r2' },
  ],
};

t('the right order of statements and reasons is accepted', () => {
  const right = core.check(proof, [
    { statement: 's1', reason: 'r1' },
    { statement: 's2', reason: 'r2' },
  ]);
  assert.equal(right.ok, true);
  assert.deepEqual(right.per, [true, true]);
});

t('a swapped order is wrong, and so is a wrong reason', () => {
  const swapped = core.check(proof, [
    { statement: 's2', reason: 'r2' },
    { statement: 's1', reason: 'r1' },
  ]);
  assert.equal(swapped.ok, false);
  assert.deepEqual(swapped.per, [false, false]);
  const wrongReason = core.check(proof, [
    { statement: 's1', reason: 'r3' },
    { statement: 's2', reason: 'r2' },
  ]);
  assert.equal(wrongReason.ok, false);
  assert.equal(wrongReason.per[0], false);
  assert.equal(wrongReason.per[1], true);
});

t('a short chain and a distractor-only chain are wrong', () => {
  assert.equal(core.check(proof, [{ statement: 's1', reason: 'r1' }]).ok, false);
  assert.equal(core.check(proof, [
    { statement: 's3', reason: 'r3' },
    { statement: 's1', reason: 'r1' },
  ]).ok, false);
});

t('a geometry question can be stored and the chain is the key', () => {
  const stored = questions.normalizeQuestion(proof);
  assert.equal(stored.type, 'geom');
  assert.equal(stored.statements.length, 3);
  assert.equal(core.check(stored, stored.chain).ok, true);
  assert.throws(() => questions.normalizeQuestion({ ...proof, chain: [{ statement: 'nope', reason: 'r1' }] }));
});

t('a memo key of type geom is marked the same way and does not need a model', () => {
  assert.ok(keys.canonical({ type: 'geom', chain: proof.chain }));
  assert.equal(keys.canonical({ type: 'geom', chain: proof.chain }), keys.canonical({
    type: 'geom',
    chain: proof.chain.map(step => ({ ...step })),
  }));
  assert.equal(keys.canonical({ type: 'geom', chain: [{ statement: 's2', reason: 'r2' }, { statement: 's1', reason: 'r1' }] })
    === keys.canonical({ type: 'geom', chain: proof.chain }), false);
});

const failed = results.filter(row => row[0] === 'FAIL');
for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
