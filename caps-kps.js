'use strict';
// Knowledge-point names and key prerequisites for the 58 CAPS-only topics.
// Seeded idempotently with ALGEBRA_KPS. Names follow CAPS / Siyavula (CC BY).

const CAPS_KPS = {
  'seq-linear': [
    { name: 'Next terms from a common difference', keyPrereq: null },
    { name: 'The general term $T_n=a+(n-1)d$', keyPrereq: null },
    { name: 'Which term has a given value', keyPrereq: null },
  ],
  'seq-quadratic': [
    { name: 'The constant second difference', keyPrereq: 'seq-linear' },
    { name: 'The general term $T_n=an^2+bn+c$', keyPrereq: 'seq-linear' },
  ],
  'seq-arithmetic': [
    { name: 'The $n$th term of an arithmetic sequence', keyPrereq: 'seq-linear' },
    { name: 'The sum $S_n$', keyPrereq: 'seq-linear' },
    { name: 'How many terms make a given sum', keyPrereq: 'seq-linear' },
  ],
  'seq-geometric': [
    { name: 'The $n$th term of a geometric sequence', keyPrereq: 'exp-int' },
    { name: 'The sum of a finite geometric series', keyPrereq: 'exp-int' },
    { name: 'Find the common ratio', keyPrereq: 'exp-int' },
  ],
  'seq-infinite': [
    { name: 'The sum to infinity when $|r|<1$', keyPrereq: 'seq-geometric' },
    { name: 'When the series diverges', keyPrereq: 'seq-geometric' },
  ],
  'seq-sum-proof': [
    { name: 'The arithmetic-sum formula from first and last terms', keyPrereq: 'seq-arithmetic' },
    { name: 'The geometric-sum formula from $S-rS$', keyPrereq: 'seq-geometric' },
  ],
  'seq-mixed': [
    { name: 'Classify a sequence', keyPrereq: 'seq-quadratic' },
    { name: 'A mixed calculation', keyPrereq: 'seq-arithmetic' },
  ],
  'quad-k': [
    { name: 'Expressions such as $x^2+1/x^2$ from $x+1/x$', keyPrereq: 'exp-int' },
    { name: 'Solve $x+1/x=k$', keyPrereq: 'quad-formula' },
  ],
  'nature-of-roots': [
    { name: 'Read the discriminant', keyPrereq: 'quad-formula' },
    { name: 'A parameter for equal roots', keyPrereq: 'quad-formula' },
    { name: 'A parameter for two distinct real roots', keyPrereq: 'quad-formula' },
  ],
  'simultaneous-nonlinear': [
    { name: 'A line and a parabola', keyPrereq: 'systems' },
    { name: 'Sum and product of the two unknowns', keyPrereq: 'systems' },
  ],
  'growth-decay': [
    { name: 'Simple interest and growth', keyPrereq: 'exp-int' },
    { name: 'Compound interest and growth', keyPrereq: 'exp-int' },
    { name: 'Reducing-balance depreciation', keyPrereq: 'exp-int' },
  ],
  'nominal-effective': [
    { name: 'Nominal rate to effective rate', keyPrereq: 'growth-decay' },
    { name: 'Effective rate to nominal rate', keyPrereq: 'growth-decay' },
  ],
  'annuity-fv': [
    { name: 'Future value of an annuity', keyPrereq: 'growth-decay' },
    { name: 'The payment that produces a given future value', keyPrereq: 'growth-decay' },
  ],
  'annuity-pv': [
    { name: 'Present value of an annuity (a loan)', keyPrereq: 'annuity-fv' },
    { name: 'The outstanding balance after some payments', keyPrereq: 'annuity-fv' },
  ],
  'finance-n': [
    { name: 'Solve for $n$ with logarithms', keyPrereq: 'log-eval' },
    { name: 'Compare two investment options', keyPrereq: 'growth-decay' },
  ],
  'hyperbola': [
    { name: 'Asymptotes $x=-p$ and $y=q$', keyPrereq: 'transform' },
    { name: 'Intercepts of a hyperbola', keyPrereq: 'transform' },
  ],
  'exp-graph': [
    { name: 'The horizontal asymptote $y=q$', keyPrereq: 'exp-int' },
    { name: 'The $y$-intercept', keyPrereq: 'exp-int' },
  ],
  'log-graph': [
    { name: 'The vertical asymptote', keyPrereq: 'log-eval' },
    { name: 'The $x$-intercept of a log graph', keyPrereq: 'log-eval' },
  ],
  'cubic-graph': [
    { name: '$x$-intercepts from factored form', keyPrereq: 'zeros' },
    { name: 'The shape of a factored cubic', keyPrereq: 'zeros' },
  ],
  'avg-gradient': [
    { name: 'Average gradient between two points', keyPrereq: 'lines' },
    { name: 'The limit of the average gradient', keyPrereq: 'lines' },
  ],
  'first-principles': [
    { name: 'First principles for $ax^2$', keyPrereq: 'avg-gradient' },
    { name: 'First principles for $ax^3$', keyPrereq: 'avg-gradient' },
    { name: 'First principles for $1/x$', keyPrereq: 'rational-expr' },
  ],
  'power-rule': [
    { name: 'Differentiate a polynomial', keyPrereq: 'first-principles' },
    { name: 'Rewrite a power and differentiate', keyPrereq: 'first-principles' },
  ],
  'tangent-calc': [
    { name: 'Gradient of a tangent', keyPrereq: 'power-rule' },
    { name: 'Equation of a tangent', keyPrereq: 'lines' },
  ],
  'cubic-derivative': [
    { name: 'Stationary points from $f\'=0$', keyPrereq: 'power-rule' },
    { name: 'A local maximum or minimum', keyPrereq: 'power-rule' },
  ],
  'derivative-graph': [
    { name: 'Where $f\'$ cuts the $x$-axis', keyPrereq: 'cubic-derivative' },
    { name: 'The sign of $f\'$', keyPrereq: 'cubic-derivative' },
  ],
  'optimisation': [
    { name: 'Maximum area of a rectangle with fixed perimeter', keyPrereq: 'cubic-derivative' },
    { name: 'Maximum product of two numbers with a fixed sum', keyPrereq: 'cubic-derivative' },
  ],
  'venn': [
    { name: 'The addition rule', keyPrereq: null },
    { name: 'The complement', keyPrereq: null },
  ],
  'dep-indep': [
    { name: 'Independent events', keyPrereq: 'venn' },
    { name: 'Without replacement', keyPrereq: 'venn' },
  ],
  'trees-tables': [
    { name: 'Multiply along a tree', keyPrereq: 'dep-indep' },
    { name: 'A two-way table', keyPrereq: 'dep-indep' },
  ],
  'counting': [
    { name: 'The fundamental counting principle', keyPrereq: 'venn' },
    { name: 'Arrangements and $n!$', keyPrereq: 'venn' },
  ],
  'word-arrangements': [
    { name: 'Distinct letters', keyPrereq: 'counting' },
    { name: 'Arrangements with repeated letters', keyPrereq: 'counting' },
  ],
  'count-prob': [
    { name: 'Two particular people standing together', keyPrereq: 'counting' },
    { name: 'A particular position in a line', keyPrereq: 'counting' },
  ],
  'five-number': [
    { name: 'The five-number summary', keyPrereq: null },
    { name: 'The interquartile range', keyPrereq: null },
  ],
  'histograms': [
    { name: 'Read a frequency from a histogram', keyPrereq: 'five-number' },
    { name: 'Skewness from a five-number summary', keyPrereq: 'five-number' },
  ],
  'variance-sd': [
    { name: 'The population variance', keyPrereq: 'five-number' },
    { name: 'How many points lie in $(\\bar x-\\sigma,\\bar x+\\sigma)$', keyPrereq: 'five-number' },
  ],
  'scatter-ls': [
    { name: 'The gradient of the least-squares line', keyPrereq: 'lines' },
    { name: 'An estimate, and interpolation versus extrapolation', keyPrereq: 'lines' },
  ],
  'correlation': [
    { name: 'Describe $r$', keyPrereq: 'scatter-ls' },
    { name: 'Correlation is not causation', keyPrereq: 'scatter-ls' },
  ],
  'midpoint-distance': [
    { name: 'The midpoint of a segment', keyPrereq: 'lines' },
    { name: 'The distance between two points', keyPrereq: 'lines' },
  ],
  'inclination': [
    { name: 'Inclination from a gradient', keyPrereq: 'lines' },
    { name: 'Parallel and perpendicular gradients', keyPrereq: 'lines' },
  ],
  'tangents-circle': [
    { name: 'A point on $x^2+y^2=r^2$', keyPrereq: 'circles' },
    { name: 'The tangent at a point on the circle', keyPrereq: 'circles' },
  ],
  'collinear-proof': [
    { name: 'Collinearity by equal gradients', keyPrereq: 'midpoint-distance' },
    { name: 'The midpoint of a diagonal of a parallelogram', keyPrereq: 'midpoint-distance' },
  ],
  'ageo-riders': [
    { name: 'The centre of a circle with a given diameter', keyPrereq: 'midpoint-distance' },
    { name: '$r^2$ from a diameter', keyPrereq: 'circles' },
  ],
  'area-rule': [
    { name: 'Area from two sides and the included angle', keyPrereq: 'oblique' },
    { name: 'Find a side from the area', keyPrereq: 'oblique' },
  ],
  'trig-graphs-deg': [
    { name: 'Amplitude and period of a sine graph', keyPrereq: 'special-angles' },
    { name: 'The tangent graph', keyPrereq: 'special-angles' },
  ],
  'reduction': [
    { name: 'Reduction to an acute angle', keyPrereq: 'special-angles' },
    { name: 'Sine and cosine of a negative angle', keyPrereq: 'special-angles' },
  ],
  'general-solution': [
    { name: 'General solution of a basic trig equation', keyPrereq: 'reduction' },
    { name: 'A cosine equation in the second and third quadrants', keyPrereq: 'reduction' },
  ],
  'graph-intersections': [
    { name: 'Where $y=\\sin x$ meets a horizontal line', keyPrereq: 'general-solution' },
    { name: 'Where $y=\\tan x$ meets a horizontal line', keyPrereq: 'trig-graphs-deg' },
  ],
  'trig-2d': [
    { name: 'A $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle', keyPrereq: 'right-tri' },
    { name: 'The cosine rule with $60^\\circ$', keyPrereq: 'oblique' },
  ],
  'trig-3d': [
    { name: 'Angle of elevation to a pole', keyPrereq: 'trig-2d' },
    { name: 'A mast on a square courtyard', keyPrereq: 'trig-2d' },
  ],
  'euc-revision': [
    { name: 'Isosceles triangles and the angle sum', keyPrereq: null },
    { name: 'Congruence conditions', keyPrereq: null },
    { name: 'The midpoint theorem', keyPrereq: null },
  ],
  'euc-chords': [
    { name: 'The perpendicular from the centre bisects a chord', keyPrereq: 'euc-revision' },
    { name: 'The line from the centre to the midpoint of a chord', keyPrereq: 'euc-revision' },
  ],
  'euc-cyclic': [
    { name: 'The angle at the centre', keyPrereq: 'euc-chords' },
    { name: 'Opposite angles of a cyclic quadrilateral', keyPrereq: 'euc-chords' },
  ],
  'euc-tan-chord': [
    { name: 'A tangent is perpendicular to the radius', keyPrereq: 'euc-cyclic' },
    { name: 'The tan-chord theorem', keyPrereq: 'euc-cyclic' },
  ],
  'euc-proportion': [
    { name: 'A line parallel to one side divides the others proportionally', keyPrereq: 'euc-revision' },
    { name: 'The converse of the proportional-intercepts theorem', keyPrereq: 'euc-revision' },
  ],
  'euc-similar': [
    { name: 'AAA similarity', keyPrereq: 'euc-proportion' },
    { name: 'Corresponding sides of similar triangles', keyPrereq: 'euc-proportion' },
  ],
  'euc-circle-riders': [
    { name: 'A rider step with the angle at the centre', keyPrereq: 'euc-tan-chord' },
    { name: 'A cyclic-quadrilateral rider', keyPrereq: 'euc-tan-chord' },
  ],
  'euc-similar-riders': [
    { name: 'Similar triangles with a parallel line', keyPrereq: 'euc-similar' },
    { name: 'Find a side from a scale factor', keyPrereq: 'euc-similar' },
  ],
  'euc-mixed': [
    { name: 'Tan-chord with the angle at the centre', keyPrereq: 'euc-circle-riders' },
    { name: 'Midpoint theorem in a mixed rider', keyPrereq: 'euc-similar-riders' },
  ],
};

module.exports = { CAPS_KPS };
