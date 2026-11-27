// Answer forms the deterministic checker marks: regions, points, general solutions,
// parameter expressions, equations and ordered lists. Equivalent answers pass; a wrong
// endpoint, bracket, pair order or a missing period fails.
'use strict';
const assert = require('node:assert/strict');
const core = require('../public/core.js');
const keys = require('../keys.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
const key = (md, type) => {
  const spec = keys.formSpec(md, type);
  assert.ok(spec, 'no key for ' + md);
  return spec;
};
const yes = (spec, ...inputs) => { for (const s of inputs) assert.equal(core.check(spec, s).ok, true, 'should accept ' + s); };
const no = (spec, ...inputs) => { for (const s of inputs) assert.equal(core.check(spec, s).ok, false, 'should reject ' + s); };

t('inequalities: compound and "or" forms', () => {
  const spec = key('$x<1$ or $x>5$ or $x\\in(-\\infty\\,;\\,1)$ or $x\\in(5\\,;\\,\\infty)$', 'inequality');
  assert.equal(spec.type, 'region');
  yes(spec, 'x<1 or x>5', 'x > 5 or x < 1', '(-inf; 1) U (5; inf)', 'x ∈ (−∞; 1) ∪ (5; ∞)');
  no(spec, 'x<=1 or x>5', 'x<1', 'x<1 or x>6', 'y<1 or y>5');
  const between = key('$-\\dfrac{1}{2}<x<\\dfrac{1}{2}$', 'inequality');
  yes(between, '-1/2 < x < 1/2', '-0.5<x<0.5', '(-0,5 ; 0,5)', 'x > -1/2 and x < 1/2');
  no(between, '-1/2 <= x < 1/2', '-1/2 < x < 1', 'x < 1/2');
});

t('intervals: brackets, unions, infinity and excluded points', () => {
  const range = key('$y\\in[-4\\,;\\,\\infty)$ or $y\\geq -4$', 'set');
  yes(range, 'y >= -4', 'y ≥ -4', '[-4; ∞)', 'y in [-4; inf)', 'y=>-4');
  no(range, 'y > -4', '(-4; inf)', 'y >= 4', 'x >= -4');
  const domain = key('$x\\in\\mathbb{R},\\ x\\neq 3$', 'set');
  yes(domain, 'x ∈ R, x ≠ 3', 'x != 3', 'x<3 or x>3', '(-inf;3) U (3;inf)');
  no(domain, 'x ∈ R', 'x != -3');
  const trig = key('$x\\in[0^{\\circ}\\,;\\,22,5^{\\circ}]\\cup[112,5^{\\circ}\\,;\\,135^{\\circ})$ or $0^{\\circ}\\le x\\le 22,5^{\\circ}$ or $112,5^{\\circ}\\le x<135^{\\circ}$', 'inequality');
  yes(trig, '0° ≤ x ≤ 22.5° or 112.5° <= x < 135°', '[0; 22,5] ∪ [112,5; 135)');
  no(trig, '[0; 22,5] ∪ [112,5; 135]', '[0; 22,5]', '[0; 22,5) ∪ [112,5; 135)');
  const point = key('$x=-180^{\\circ}$ or $x\\in(-90^{\\circ}\\,;\\,0^{\\circ}]$', 'inequality');
  yes(point, 'x = -180 or -90 < x <= 0');
  no(point, '-90 < x <= 0', 'x = -180 or -90 <= x <= 0');
  const two = key('$0<x<4$ or $0\\leq x\\leq 4$', 'inequality');
  yes(two, '0<x<4', '0<=x<=4');
  no(two, '0<x<=4');
});

t('coordinate pairs and sets of pairs', () => {
  const one = key('$C\\left(-6\\,;\\,-\\dfrac{9}{4}\\right)$', 'coordinates');
  assert.equal(one.type, 'points');
  yes(one, '(-6; -9/4)', 'C(-6 ; -2,25)', '(-6, -2.25)', 'x = -6, y = -9/4');
  no(one, '(-9/4; -6)', '(-6; 9/4)', '-6');
  const pair = key('$A(-9\\,;\\,0)$ and $B(-3\\,;\\,0)$', 'coordinates');
  yes(pair, 'A(-9;0) and B(-3;0)', '(-3; 0) and (-9; 0)');
  no(pair, '(-9; 0)', '(0; -9) and (0; -3)', '(-9;0) and (-3;0) and (1;1)');
  const sims = key('$x=14$, $y=-2$ or $x=1$, $y=11$', 'coordinates');
  yes(sims, 'x = 1, y = 11 or x = 14, y = -2', '(14; -2) and (1; 11)', 'y=-2, x=14 or y=11, x=1');
  no(sims, 'x = 14, y = -2', 'x = -2, y = 14 or x = 11, y = 1');
  const param = key('$(-p\\,;\\,0)$', 'coordinates');
  yes(param, '(-p; 0)', '(0 - p; 0)');
  no(param, '(p; 0)', '(0; -p)');
});

t('trig general solutions with k ∈ Z', () => {
  const spec = key('$x=42^{\\circ}+k\\cdot 360^{\\circ}$ or $x=-14^{\\circ}-k\\cdot 120^{\\circ}$, $k\\in\\mathbb{Z}$', 'solution_set');
  assert.equal(spec.type, 'trig');
  yes(spec, 'x = 42 + k360 or x = -14 + 120k, k ∈ Z', 'x=42°+k.360° ; x=106°+k.120°; x = -14 + k·120', 'x = -14 + k*120 or x = 42 + k*360 (k in Z)');
  const pm = key('$x=180^{\\circ}+k\\cdot 360^{\\circ}$ or $x=120^{\\circ}+k\\cdot 360^{\\circ}$ or $x=240^{\\circ}+k\\cdot 360^{\\circ}$, $k\\in\\mathbb{Z}$', 'solution_set');
  yes(pm, 'x = 180 + k360 or x = ±120 + k360', 'x=180°+k.360°; x=+-120°+k.360°');
  no(pm, 'x = ±120 + k360');
  no(spec, 'x = 42 or x = -14', 'x = 42 + k360', 'x = 42 + k180 or x = -14 + k120', 'x = 43 + k360 or x = -14 + k120');
  assert.equal(core.check(spec, 'x = 42 or x = -14').missingPeriod, true);
  const rounded = key('$x=116,57^{\\circ}+k\\cdot 180^{\\circ}$, $k\\in\\mathbb{Z}$ (reject $x=45^{\\circ}+k\\cdot 180^{\\circ}$)', 'solution_set');
  yes(rounded, 'x = 116,57 + k.180', 'x = -63.43 + 180k', 'x=116.57+k360 or x=296.57+k360');
  no(rounded, 'x = 116.57 + k180 or x = 45 + k180', 'x = 116.57 + k360');
});

t('expressions in a parameter, by equivalence', () => {
  const spec = key('$\\dfrac{k^2-1}{k^2+1}$', 'expression');
  yes(spec, '(k^2-1)/(k^2+1)', '1 - 2/(k²+1)', '(k-1)(k+1)/(1+k^2)');
  no(spec, '(k^2+1)/(k^2-1)', '(k-1)/(k+1)');
  const tn = key('$T_n=n^2-34n+354$', 'equation');
  yes(tn, 'T_n = n^2 - 34n + 354', 'Tn = (n-17)^2 + 65', 'n² - 34n + 354');
  no(tn, 'n^2 - 34n + 345', 'T_n = n^2 + 34n + 354');
  const label = key('$\\cos 40^{\\circ}=\\dfrac{k}{\\sqrt{k^2+1}}$', 'expression');
  yes(label, 'k/sqrt(k^2+1)', 'cos40 = k/√(k²+1)');
  no(label, 'k/sqrt(k^2-1)', '1/sqrt(k^2+1)');
  const deg = key('$-\\cos x$', 'value');
  yes(deg, '-cos x', 'cos(180 - x)', '-sin(90 - x)');
  no(deg, 'cos x', 'sin x');
});

t('equations in equivalent rearranged forms', () => {
  const circle = key('$(x+3)^2+(y-4)^2=64$', 'equation');
  assert.equal(circle.type, 'eqn');
  yes(circle, '(x+3)^2+(y-4)^2=64', 'x^2 + 6x + y^2 - 8y - 39 = 0', '64 = (y-4)² + (x+3)²');
  no(circle, '(x-3)^2+(y-4)^2=64', '(x+3)^2+(y-4)^2=8');
  const exp = key('$y=\\left(\\dfrac{1}{3}\\right)^{x}=3^{-x}$', 'equation');
  yes(exp, 'y = 3^(-x)', 'y = (1/3)^x', '3^x * y = 1');
  no(exp, 'y = 3^x', 'y = -3^x');
  const line = key('$\\hat{y}=9,5+0,91x$', 'equation');
  yes(line, 'y = 9.5 + 0.91x', 'y = 0,91x + 9,5');
  no(line, 'y = 9.5 + 0.19x');
});

t('ordered lists and values with units', () => {
  const list = key('$209\\,;\\,186$', 'value');
  assert.equal(list.type, 'tuple');
  yes(list, '209; 186', '209, 186');
  no(list, '186; 209', '209');
  const area = key('$34,67$ m$^2$', 'value');
  yes(area, '34.67', '34,67');
  no(area, '34.76');
});

t('prose, sketches and log bases stay unscored', () => {
  for (const [md, type] of [
    ['$f$ is shifted $3$ units to the right', 'description'],
    ['$y=\\log_2 x$', 'equation'],
    ['$n\\in\\{3\\,;\\,5\\,;\\,7\\,;\\,\\dots\\}$, i.e. $n$ is an odd number greater than $2$', 'set'],
    ['C', 'value'],
    ['$y=-\\sqrt{-\\dfrac{1}{6}x}$, $x\\le 0$', 'equation'],
    ['$\\sin(A-B)=\\sin A\\cos B-\\cos A\\sin B$', 'proof'],
  ]) assert.equal(keys.formSpec(md, type), null, md);
});

t('a rounded decimal and the equivalent mixed number are the same value', () => {
  const spec = key('$4,67$  or  $4\\dfrac{2}{3}$', 'value');
  assert.equal(spec.type, 'num');
  assert.equal(core.check(spec, '4,67').ok, true);
  assert.equal(core.check(spec, '14/3').ok, true);
  assert.equal(core.check(spec, '2/3').ok, false);
});

t('every form has an input hint', () => {
  for (const type of ['region', 'points', 'trig', 'eqn', 'tuple', 'expr', 'num']) assert.ok(core.HINTS[type], type);
});

const failed = results.filter(row => row[0] === 'FAIL');
for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
