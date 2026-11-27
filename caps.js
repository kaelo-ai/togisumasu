// Grade 12 CAPS Mathematics as a slice of the master topic graph.
// Topics that already exist in the algebra course are reused by id.
// New topics are CAPS-only nodes. Off-CAPS topics stay in the master graph
// and are not members of this course, so they are not prerequisites inside it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const COURSE_ID = 'gr12-caps';
const BANK = path.join(__dirname, 'data', 'nsc');

// Taught in the algebra course, never in this slice.
const OFF_CAPS = [
  'complex', 'abs-eq', 'abs-ineq', 'deg-rad', 'unit-circle', 'inv-trig',
  'composition', 'log-props', 'log-eq',
];

const UNITS = [
  ['c0', 'Foundations (Grade 10–11)'],
  ['c1', 'Algebra, equations and inequalities'],
  ['c2', 'Number patterns, sequences and series'],
  ['c3', 'Functions and graphs'],
  ['c4', 'Finance, growth and decay'],
  ['c5', 'Differential calculus'],
  ['c6', 'Counting and probability'],
  ['c7', 'Statistics and regression'],
  ['c8', 'Analytical geometry'],
  ['c9', 'Trigonometry'],
  ['c10', 'Euclidean geometry'],
];

const p = html => `<p>${html}</p>`;

// existing: true means the id is already a master-graph node. pre is ignored then
// (the node's own edges stay). New nodes carry the edges below.
const TOPICS = [
  // Unit 0 — always taught, not a placement test.
  { id: 'exp-int', unit: 'c0', existing: true },
  { id: 'exp-rat', unit: 'c0', existing: true },
  { id: 'radicals', unit: 'c0', existing: true },
  { id: 'poly-mult', unit: 'c0', existing: true },
  { id: 'factoring', unit: 'c0', existing: true },
  { id: 'rational-expr', unit: 'c0', existing: true },
  { id: 'linear-eq', unit: 'c0', existing: true },
  { id: 'literal', unit: 'c0', existing: true },
  { id: 'linear-ineq', unit: 'c0', existing: true },
  { id: 'systems', unit: 'c0', existing: true },
  { id: 'seq-linear', unit: 'c0', name: 'Linear sequences', pre: [],
    notes: p('A linear sequence has a constant first difference, the common difference $d$. The general term is $T_n=a+(n-1)d$.') },
  { id: 'func-eval', unit: 'c0', existing: true },
  { id: 'domain', unit: 'c0', existing: true },
  { id: 'lines', unit: 'c0', existing: true },
  { id: 'midpoint-distance', unit: 'c0', name: 'Midpoint and distance', pre: ['lines'],
    notes: p('Midpoint $\\left(\\frac{x_1+x_2}{2},\\frac{y_1+y_2}{2}\\right)$. Distance $\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$.') },
  { id: 'special-angles', unit: 'c0', existing: true },
  { id: 'right-tri', unit: 'c0', existing: true },
  { id: 'euc-revision', unit: 'c0', name: 'Triangles, congruence and the midpoint theorem', pre: [],
    oldNotes: [p('Grade 10–11 geometry used in Grade 12: vertically opposite, corresponding and alternate angles; congruence (SSS, SAS, AAS, RHS); properties of parallelograms, rectangles, rhombi, squares and kites; the midpoint theorem and its converse. Reasons must be written in the accepted form.')],
    notes: p('Grade 12 geometry in Paper 2 is about circles and similar triangles. Every proof you write there leans on facts from Grades 10 and 11: how angles behave on straight lines and parallel lines, what you know about a triangle’s angles, when two triangles are exact copies of each other, what makes a shape a parallelogram, and the midpoint theorem. This unit rebuilds those facts from the start, so it does not matter if you have forgotten them.') +
      p('It comes in three parts. Each part explains its ideas one small step at a time, with a diagram and worked examples from easy to harder, and then gives you questions like them:') +
      '<ol><li><b>Isosceles triangles and the angle sum.</b> Angles on a straight line and round a point, vertically opposite angles, the angles made by parallel lines, the angles of a triangle, and isosceles and equilateral triangles.</li><li><b>Congruence.</b> When two triangles are exact copies, the four tests that prove it, and how they give the properties of parallelograms, rectangles, rhombuses, squares and kites.</li><li><b>The midpoint theorem</b> and its converse.</li></ol>' +
      p('In the exam, each line of a geometry answer has two parts: a <b>statement</b> (what you found) and a <b>reason</b> (the fact that makes it true). Examiners expect the reasons in a short standard form, such as “∠s on a str line” for “angles on a straight line add up to $180^\\circ$”. Each short form is explained in plain words the first time it appears.') +
      p('How to read the diagrams: sides with the same tick marks are equal, angles with the same arc are equal, matching arrows mark parallel lines, and a small square marks a right angle ($90^\\circ$).') },
  { id: 'growth-decay', unit: 'c0', name: 'Simple and compound growth and decay', pre: ['exp-int'],
    notes: p('Simple: $A=P(1+in)$ and $A=P(1-in)$. Compound growth: $A=P(1+i)^n$. Compound decay (reducing balance): $A=P(1-i)^n$. Straight-line depreciation is the simple-decay formula. No continuous compounding.') },
  { id: 'five-number', unit: 'c0', name: 'Five-number summary and ogives', pre: [],
    notes: p('The five-number summary is minimum, $Q_1$, median, $Q_3$, maximum. Draw a box-and-whisker plot from it. An ogive plots cumulative frequency at the upper class limit and starts at the lower limit of the first class.') },
  { id: 'venn', unit: 'c0', name: 'Venn diagrams and the addition rule', pre: [],
    notes: p('$P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$. For mutually exclusive events the intersection is empty, so the probabilities add. The complement is $P(A\')=1-P(A)$.') },
  { id: 'basic-identities', unit: 'c0', existing: true },
  { id: 'oblique', unit: 'c0', existing: true },
  { id: 'area-rule', unit: 'c0', name: 'Area rule', pre: ['oblique'],
    notes: p('Area of $\\triangle ABC=\\frac12 ab\\sin C$. Use it when you know two sides and the included angle.') },

  // Unit 1 — algebra. Completing the square is vertex form only, not a solving method.
  { id: 'quad-factor', unit: 'c1', existing: true },
  { id: 'quad-k', unit: 'c1', name: 'Equations by $k$-substitution', pre: ['quad-factor', 'exp-int'],
    notes: p('When every variable part is a power of the same expression, set $k$ equal to that expression ($k=2^x$ or $k=x+\\frac1x$), solve the quadratic in $k$, then come back. Reject any $k$ the substitution cannot produce.') },
  { id: 'radical-eq', unit: 'c1', existing: true },
  { id: 'quad-formula', unit: 'c1', existing: true },
  { id: 'nature-of-roots', unit: 'c1', name: 'Nature of the roots', pre: ['quad-formula'],
    notes: p('For $ax^2+bx+c=0$, $D=b^2-4ac$. $D>0$: real and unequal. $D=0$: real and equal. $D<0$: non-real. Do not call the roots complex, and do not solve by completing the square.') },
  { id: 'complete-square', unit: 'c1', existing: true },
  { id: 'remainder', unit: 'c1', existing: true },
  { id: 'zeros', unit: 'c1', existing: true },
  { id: 'simultaneous-nonlinear', unit: 'c1', name: 'Linear and quadratic simultaneous equations', pre: ['systems', 'quad-factor'],
    notes: p('Make one variable the subject of the linear equation and substitute into the quadratic. Check every pair in both original equations.') },
  { id: 'poly-ineq', unit: 'c1', existing: true },

  // Unit 2
  { id: 'seq-quadratic', unit: 'c2', name: 'Quadratic sequences', pre: ['seq-linear'],
    notes: p('A quadratic sequence has a constant second difference. The general term is $T_n=an^2+bn+c$. The second difference is $2a$, the first first-difference gives $3a+b$, and $T_1=a+b+c$.') },
  { id: 'seq-arithmetic', unit: 'c2', name: 'Arithmetic sequences and series', pre: ['seq-linear'],
    notes: p('$T_n=a+(n-1)d$ and $S_n=\\frac n2\\big(2a+(n-1)d\\big)=\\frac n2(a+l)$. Sigma notation $\\sum$ is a sum of terms. Solve for $n$ only when $n$ is a positive integer.') },
  { id: 'seq-geometric', unit: 'c2', name: 'Geometric sequences and series', pre: ['seq-linear', 'exp-int'],
    notes: p('$T_n=ar^{n-1}$. For $r\\ne 1$, $S_n=\\frac{a(r^n-1)}{r-1}$. Check the ratio from any two consecutive terms.') },
  { id: 'seq-infinite', unit: 'c2', name: 'Infinite geometric series', pre: ['seq-geometric'],
    notes: p('The series converges only when $-1<r<1$. Then $S_\\infty=\\frac{a}{1-r}$. If $|r|\\ge 1$ there is no finite sum.') },
  { id: 'seq-sum-proof', unit: 'c2', name: 'Deriving the sum formulae', pre: ['seq-arithmetic', 'seq-geometric'],
    notes: p('You must be able to derive $S_n$ for an arithmetic series (pairing terms) and for a geometric series (subtract $rS_n$ from $S_n$). These derivations are examinable bookwork.') },
  { id: 'seq-mixed', unit: 'c2', name: 'Mixed sequences and series', pre: ['seq-arithmetic', 'seq-geometric', 'seq-quadratic'],
    notes: p('Decide which kind of pattern you have before you choose a formula. A question may mix a quadratic sequence with a series, or ask which term is the first to pass a value.') },

  // Unit 3
  { id: 'vertex', unit: 'c3', existing: true },
  { id: 'hyperbola', unit: 'c3', name: 'Hyperbolas $y=\\frac{a}{x+p}+q$', pre: ['rational-expr', 'transform'],
    notes: p('The only hyperbola in this course is $y=\\frac{a}{x+p}+q$. Vertical asymptote $x=-p$, horizontal asymptote $y=q$, and the axes of symmetry are $y=x+p+q$ and $y=-(x+p)+q$ when the asymptotes are horizontal and vertical.') },
  { id: 'exp-graph', unit: 'c3', name: 'Exponential graphs', pre: ['exp-int', 'transform'],
    notes: p('$y=ab^{x+p}+q$ has horizontal asymptote $y=q$. It is increasing when $b>1$ and $a>0$. The inverse of an exponential graph is a log graph.') },
  { id: 'log-eval', unit: 'c3', existing: true },
  { id: 'log-graph', unit: 'c3', name: 'Logarithmic graphs', pre: ['log-eval', 'exp-graph'],
    notes: p('$y=\\log_b x$ is defined for $x>0$, passes through $(1,0)$ and $(b,1)$, and has a vertical asymptote $x=0$. Shifts work as for other graphs. Do not drill logarithm laws; use only the definition $\\log_b a=c\\iff b^c=a$.') },
  { id: 'inverse', unit: 'c3', existing: true },
  { id: 'transform', unit: 'c3', existing: true },
  { id: 'cubic-graph', unit: 'c3', name: 'Cubic graphs', pre: ['zeros', 'transform'],
    notes: p('Read a cubic from its intercepts and turning points. $y=a(x-s)(x-t)(x-u)$ has $x$-intercepts at $s$, $t$ and $u$. The sign of $a$ tells you which way the arms go.') },

  // Unit 4
  { id: 'nominal-effective', unit: 'c4', name: 'Nominal and effective rates', pre: ['growth-decay'],
    notes: p('Nominal rate $i^{(m)}$ compounded $m$ times a year converts by $1+i_{\\text{eff}}=\\left(1+\\frac{i^{(m)}}{m}\\right)^m$. Compare investments on the effective annual rate.') },
  { id: 'annuity-fv', unit: 'c4', name: 'Future-value annuities', pre: ['growth-decay'],
    notes: p('A deposit of $x$ at the end of every period, $n$ deposits, interest $i$ per period: $F=\\frac{x\\big((1+i)^n-1\\big)}{i}$. Sinking funds and savings accounts use this.') },
  { id: 'annuity-pv', unit: 'c4', name: 'Present-value annuities and loans', pre: ['annuity-fv'],
    notes: p('A loan of $P$ repaid by $n$ equal payments of $x$: $P=\\frac{x\\big(1-(1+i)^{-n}\\big)}{i}$. A deferred annuity is an ordinary annuity whose present value is then discounted back across the waiting periods.') },
  { id: 'finance-n', unit: 'c4', name: 'Solving for $n$, balance and comparisons', pre: ['log-eval', 'annuity-fv', 'annuity-pv'],
    notes: p('To find the number of periods, rearrange to an exponential and use the log definition. The outstanding balance of a loan is the present value of the payments still to be made. Compare options by the total paid or by the effective rate. No pyramid schemes.') },

  // Unit 5 — differentiation only, no integration.
  { id: 'avg-gradient', unit: 'c5', name: 'Average gradient and limits', pre: ['lines', 'func-eval'],
    notes: p('The average gradient of $f$ between $x$ and $x+h$ is $\\frac{f(x+h)-f(x)}{h}$. The derivative is the limit of that quotient as $h\\to 0$.') },
  { id: 'first-principles', unit: 'c5', name: 'Differentiation from first principles', pre: ['avg-gradient', 'rational-expr'],
    notes: p('Use $f\'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}$ for the CAPS types: $k$, $ax$, $ax^2$, $ax^3$ and $a/x$.') },
  { id: 'power-rule', unit: 'c5', name: 'Rules of differentiation', pre: ['first-principles'],
    notes: p('If $f(x)=ax^n$ then $f\'(x)=anx^{n-1}$, for integer $n$. Rewrite roots and fractions as powers first. The derivative of a sum is the sum of the derivatives.') },
  { id: 'tangent-calc', unit: 'c5', name: 'Equations of tangents', pre: ['power-rule', 'lines'],
    notes: p('The gradient of the tangent at $x=a$ is $f\'(a)$. The tangent is the line through $(a,f(a))$ with that gradient. A point where $f\'(x)=0$ is a stationary point.') },
  { id: 'cubic-derivative', unit: 'c5', name: 'Cubic graphs from the derivative', pre: ['power-rule', 'cubic-graph'],
    notes: p('Stationary points solve $f\'(x)=0$. The second derivative, or the sign of $f\'$ on either side, tells a local maximum from a local minimum. Sketch with intercepts and turning points.') },
  { id: 'derivative-graph', unit: 'c5', name: 'Graph of a derivative', pre: ['cubic-derivative'],
    notes: p('Where $f$ is increasing, $f\'$ is positive. Turning points of $f$ are $x$-intercepts of $f\'$. A cubic\'s derivative is a parabola. Concavity: $f\'\'>0$ means concave up.') },
  { id: 'optimisation', unit: 'c5', name: 'Optimisation', pre: ['cubic-derivative'],
    notes: p('Write the quantity you want as a function of one variable, using the constraint to eliminate the other. Differentiate, set the derivative to zero, and check that the stationary point is the kind you were asked for.') },

  // Unit 6 — no nCr, no combinations, no conditional probability, no circular arrangements.
  { id: 'dep-indep', unit: 'c6', name: 'Independent events and without replacement', pre: ['venn'],
    notes: p('Independent: $P(A\\text{ and }B)=P(A)\\cdot P(B)$. Without replacement the second probability changes because the total has dropped. Do not use the conditional-probability formula $P(A|B)$.') },
  { id: 'trees-tables', unit: 'c6', name: 'Tree diagrams and contingency tables', pre: ['dep-indep'],
    notes: p('A tree multiplies along a path and adds mutually exclusive paths. A contingency table is filled from the given totals; a probability is a cell divided by the grand total.') },
  { id: 'counting', unit: 'c6', name: 'Counting principle and factorials', pre: ['venn'],
    notes: p('If one choice has $m$ options and a later choice has $n$, there are $m\\times n$ outcomes. $n!=n\\times(n-1)\\times\\cdots\\times 1$. This course does not use ${}^nC_r$ or combinations.') },
  { id: 'word-arrangements', unit: 'c6', name: 'Arrangements of letters', pre: ['counting'],
    notes: p('Distinct letters: $n!$. Repeated letters: divide by the factorial of each repeat. A block of letters that must stay together is one item, and the letters inside the block can still be arranged. No circular arrangements.') },
  { id: 'count-prob', unit: 'c6', name: 'Counting in probability', pre: ['counting', 'dep-indep'],
    notes: p('When each arrangement is equally likely, the probability is the number of favourable arrangements divided by the number of possible arrangements.') },

  // Unit 7 — no normal-curve reading of standard deviation.
  { id: 'histograms', unit: 'c7', name: 'Histograms, ogives, skewness and outliers', pre: ['five-number'],
    notes: p('A histogram uses class intervals on the horizontal axis; frequency is the height when classes have equal width. Skewness: a long tail to the right is skewed right (mean pulled above the median). An outlier sits far from the rest of the data. Do not interpret a standard deviation with the normal curve.') },
  { id: 'variance-sd', unit: 'c7', name: 'Variance and standard deviation', pre: ['five-number'],
    notes: p('On a calculator, $\\sigma^2$ is the variance and $\\sigma$ is the population standard deviation used in CAPS. About the interval $(\\bar x-\\sigma,\\bar x+\\sigma)$: count how many data points fall inside it. No normal-distribution percentages.') },
  { id: 'scatter-ls', unit: 'c7', name: 'Scatter plots and least-squares lines', pre: ['lines', 'variance-sd'],
    notes: p('Plot the given pairs. The least-squares line $\\hat y=A+Bx$ is computed on the calculator. $A$ is the intercept and $B$ the gradient. Use the line to estimate, and say when you are extrapolating past the data.') },
  { id: 'correlation', unit: 'c7', name: 'Correlation', pre: ['scatter-ls'],
    notes: p('$r$ is between $-1$ and $1$. Close to $1$: strong positive linear relationship. Close to $-1$: strong negative. Close to $0$: little linear relationship. Correlation does not by itself mean one variable causes the other.') },

  // Unit 8
  { id: 'inclination', unit: 'c8', name: 'Inclination, parallel and perpendicular lines', pre: ['lines'],
    notes: p('The inclination $\\theta$ satisfies $\\tan\\theta=m$, with $0^\\circ\\le\\theta<180^\\circ$. Parallel lines have equal gradients. Perpendicular lines have gradients whose product is $-1$, unless one line is vertical.') },
  { id: 'circles', unit: 'c8', existing: true },
  { id: 'tangents-circle', unit: 'c8', name: 'Tangents to a circle', pre: ['circles', 'lines'],
    notes: p('A tangent is perpendicular to the radius at the point of contact. Its equation is the line through the point of contact with that gradient. The length of a tangent from an external point can be read from a right triangle with the radius.') },
  { id: 'collinear-proof', unit: 'c8', name: 'Collinearity and polygons', pre: ['midpoint-distance', 'inclination'],
    notes: p('Three points are collinear when the gradients between each pair are equal, or when the distances add. A quadrilateral is a parallelogram when the diagonals bisect (same midpoint) or when both pairs of opposite sides are parallel.') },
  { id: 'ageo-riders', unit: 'c8', name: 'Analytical geometry riders', pre: ['tangents-circle', 'collinear-proof'],
    notes: p('Longer questions mix distance, midpoint, gradient, the line equation and the circle. Write the reason for each claim (equal gradients, product $-1$, radii equal) rather than only the calculation.') },

  // Unit 9 — degrees only. No radians, no reciprocal ratios as a topic.
  { id: 'trig-graphs-deg', unit: 'c9', name: 'Trigonometric graphs, including tangent', pre: ['special-angles', 'basic-identities'],
    notes: p('In degrees, $y=a\\sin(bx+p)+q$ and the cosine twin have amplitude $|a|$, period $360^\\circ/|b|$ and vertical shift $q$. $y=\\tan x$ has period $180^\\circ$ and is undefined at $90^\\circ+180^\\circ k$.') },
  { id: 'reduction', unit: 'c9', name: 'Reduction formulae', pre: ['special-angles'],
    notes: p('Reduce to an acute angle: $\\sin(180^\\circ-\\theta)=\\sin\\theta$, $\\cos(180^\\circ-\\theta)=-\\cos\\theta$, $\\tan(180^\\circ-\\theta)=-\\tan\\theta$, and the matching identities for $180^\\circ+\\theta$, $360^\\circ-\\theta$ and $90^\\circ\\pm\\theta$. Then apply the quadrant sign.') },
  { id: 'sum-diff', unit: 'c9', existing: true },
  { id: 'double-angle', unit: 'c9', existing: true },
  { id: 'general-solution', unit: 'c9', name: 'General solution in degrees', pre: ['double-angle', 'reduction'],
    notes: p('Solve on $[0^\\circ,360^\\circ)$ first, using the reference angle and the quadrants where the ratio has the right sign. The general solution adds the period: $360^\\circ k$ for sine and cosine, $180^\\circ k$ for tangent, $k\\in\\mathbb{Z}$.') },
  { id: 'graph-intersections', unit: 'c9', name: 'Where trig graphs meet', pre: ['trig-graphs-deg', 'general-solution'],
    notes: p('Set the two formulae equal and solve the resulting trig equation on the interval drawn. The solutions are the $x$-coordinates of the intersections. Read inequalities off the same picture.') },
  { id: 'trig-2d', unit: 'c9', name: 'Two-dimensional trig problems', pre: ['area-rule', 'oblique', 'right-tri'],
    notes: p('In a figure, pick the rule that matches what you know: a right angle (ratios), an angle with its opposite side (sine rule), two sides and the included angle (cosine rule or area rule).') },
  { id: 'trig-3d', unit: 'c9', name: 'Three-dimensional trig problems', pre: ['trig-2d'],
    notes: p('Draw the horizontal and vertical right triangles separately. An angle of elevation or depression is measured from the horizontal. Do not combine lengths from different planes in one ratio.') },

  // Unit 10 — the seven examinable proofs, then riders.
  { id: 'euc-chords', unit: 'c10', name: 'Chords and the centre', pre: ['euc-revision'],
    oldNotes: [p('Prove: the line from the centre of a circle perpendicular to a chord bisects the chord, and the line from the centre to the midpoint of a chord is perpendicular to the chord.')],
    notes: p('A chord is a straight line joining two points on a circle. This topic is about the line from the centre of the circle to a chord.') +
      p('There are two facts, and they are one picture read two ways. A line from the centre that meets a chord at a right angle ($90^\\circ$) cuts the chord exactly in half. And a line from the centre to the middle of a chord meets it at a right angle. With Pythagoras, they let you work out lengths inside a circle.') +
      p('The exam can ask you to prove the first fact yourself. Proving one of the textbook theorems like this is called bookwork, and you will see that proof as a worked example.') },
  { id: 'euc-cyclic', unit: 'c10', name: 'Angle at the centre and cyclic quads', pre: ['euc-chords'],
    oldNotes: [p('Prove: the angle at the centre is twice the angle at the circumference (same arc), and the opposite angles of a cyclic quadrilateral are supplementary.')],
    notes: p('This topic is about angles with their corner on a circle or at its centre. The main fact: when two angles open onto the same piece of the circle, the one at the centre is twice the one at the edge.') +
      p('Three more facts follow from it. An angle that opens onto a diameter (a line across the circle through the centre) is $90^\\circ$. Angles that open onto the same piece of the circle from the same side are equal. And in a four-sided shape with all four corners on a circle, called a cyclic quadrilateral, opposite angles add up to $180^\\circ$.') },
  { id: 'euc-tan-chord', unit: 'c10', name: 'Tangents and the tan-chord theorem', pre: ['euc-cyclic'],
    oldNotes: [p('A tangent is perpendicular to the radius at the point of contact. Tangents from a common external point are equal. Prove the tan-chord theorem: the angle between a tangent and a chord equals the angle in the alternate segment.')],
    notes: p('A tangent is a straight line that just touches a circle at one point without cutting into it.') +
      p('This topic gives three facts about tangents. A tangent meets the radius at the touching point at $90^\\circ$. Two tangents drawn from the same outside point are the same length. And the angle between a tangent and a chord (a line across the circle starting at the touching point) equals the angle on the far side of that chord: this is the tan-chord theorem.') },
  { id: 'euc-proportion', unit: 'c10', name: 'Proportionality', pre: ['euc-revision'],
    notes: p('Prove: a line parallel to one side of a triangle divides the other two sides proportionally. The converse is also used. Write ratios in matching order.') },
  { id: 'euc-similar', unit: 'c10', name: 'Similar triangles', pre: ['euc-proportion'],
    oldNotes: [p('Prove: equiangular triangles are similar. Corresponding sides are then proportional. AAA, and the other similarity conditions you may quote, are used in riders.')],
    notes: p('Two triangles are similar when they have the same shape, even if one is bigger than the other, like a photo and its enlargement.') +
      p('If the three angles of one triangle are equal to the three angles of another, the triangles are similar. Then their matching sides are in the same ratio: each side of the big triangle divided by its partner in the small one gives the same number. That lets you work out missing lengths.') },
  { id: 'euc-circle-riders', unit: 'c10', name: 'Circle-geometry riders', pre: ['euc-tan-chord'],
    oldNotes: [p('Apply the circle theorems, including converses, in a figure you have not seen. Each statement needs an acceptable reason. Bookwork proofs themselves are capped in the exam; riders are where the marks are.')],
    notes: p('A rider is an exam question with a diagram you have not seen before, where you use the circle facts you already know to find an angle or prove something. Most of the marks for circle geometry come from riders, not from proving the theorems themselves.') +
      p('This topic practises the two most common kinds: riders that go through the angle at the centre, and riders with a cyclic quadrilateral (four corners on one circle). Each answer is a short chain of lines, and every line has a statement and its reason.') },
  { id: 'euc-similar-riders', unit: 'c10', name: 'Similarity riders', pre: ['euc-similar'],
    notes: p('Find the similar triangles, name them in corresponding order, then write the proportion. Area ratios are the square of the side ratio.') },
  { id: 'euc-mixed', unit: 'c10', name: 'Mixed geometry riders', pre: ['euc-circle-riders', 'euc-similar-riders'],
    oldNotes: [p('The last Euclidean question often mixes a circle with a proportion. Keep the two chains separate and state which theorem each step uses.')],
    notes: p('The last geometry question in Paper 2 often mixes ideas. This topic practises two common mixes: a tangent (a line that just touches the circle) together with the angle at the centre, and the midpoint theorem used inside a circle.') +
      p('The hard part is choosing which fact to use first. The lessons show how to spot the way in, and every step is written as a statement with its reason.') },
];

// Bank skill code → master topic. Codes are looked up, never used as foreign keys.
const SKILL_TOPIC = {
  'exp.laws-of-exponents': 'exp-int',
  'exp.exponential-equation-substitution': 'quad-k',
  'alg.surd-equation': 'radical-eq',
  'alg.factorise-trinomial': 'factoring',
  'alg.zero-product': 'quad-factor',
  'alg.quadratic-formula': 'quad-formula',
  'alg.quadratic-inequality': 'poly-ineq',
  'alg.substitution-to-quadratic': 'quad-k',
  'alg.simultaneous-linear': 'systems',
  'alg.simultaneous-linear-quadratic': 'simultaneous-nonlinear',
  'alg.words-to-equations': 'linear-eq',
  'alg.factor-theorem-cubic': 'zeros',
  'alg.nature-of-roots': 'nature-of-roots',
  'alg.algebraic-fractions': 'rational-expr',
  'alg.factorise-cubes-grouping': 'factoring',
  'seq.arithmetic-general-term': 'seq-arithmetic',
  'seq.sigma-notation': 'seq-arithmetic',
  'seq.arithmetic-series-sum': 'seq-arithmetic',
  'seq.quadratic-second-difference': 'seq-quadratic',
  'seq.quadratic-general-term': 'seq-quadratic',
  'seq.solve-for-n': 'seq-arithmetic',
  'seq.geometric-common-ratio': 'seq-geometric',
  'seq.geometric-general-term': 'seq-geometric',
  'seq.geometric-series-sum': 'seq-geometric',
  'seq.geometric-sum-to-infinity': 'seq-infinite',
  'fn.intercepts': 'func-eval',
  'fn.domain-range': 'domain',
  'fn.interval-notation': 'domain',
  'fn.quadratic-turning-point': 'vertex',
  'fn.parabola-symmetry': 'vertex',
  'fn.parabola-equation-from-points': 'vertex',
  'fn.hyperbola-asymptotes': 'hyperbola',
  'fn.hyperbola-equation-from-conditions': 'hyperbola',
  'fn.hyperbola-axes-of-symmetry': 'hyperbola',
  'fn.inequality-from-graph': 'poly-ineq',
  'fn.translate-graph': 'transform',
  'fn.reflect-in-axes': 'transform',
  'fn.log-definition': 'log-eval',
  'fn.inverse-exp-log': 'inverse',
  'fn.inverse-quadratic': 'inverse',
  'fn.inverse-linear': 'inverse',
  'fn.exponential-graph-properties': 'exp-graph',
  'fn.sketch-exponential': 'exp-graph',
  'fn.linear-function-gradient-intercept': 'lines',
  'fn.vertical-distance-between-graphs': 'cubic-graph',
  'fin.compound-growth': 'growth-decay',
  'fin.depreciation': 'growth-decay',
  'fin.nominal-effective': 'nominal-effective',
  'fin.future-value-annuity': 'annuity-fv',
  'fin.present-value-annuity': 'annuity-pv',
  'fin.deferred-annuity': 'annuity-pv',
  'fin.solve-n-with-logs': 'finance-n',
  'fin.outstanding-balance': 'finance-n',
  'calc.first-principles': 'first-principles',
  'calc.power-rule': 'power-rule',
  'calc.tangent-equation': 'tangent-calc',
  'calc.rate-of-change': 'tangent-calc',
  'calc.stationary-points': 'cubic-derivative',
  'calc.sketch-cubic': 'cubic-derivative',
  'calc.cubic-equation-from-roots': 'zeros',
  'calc.concavity': 'derivative-graph',
  'calc.optimisation-model': 'optimisation',
  'calc.optimisation-solve': 'optimisation',
  'prob.venn-diagram': 'venn',
  'prob.addition-rule': 'venn',
  'prob.independence-test': 'dep-indep',
  'prob.contingency-table': 'trees-tables',
  'prob.tree-diagram': 'trees-tables',
  'count.fundamental-counting-principle': 'counting',
  'count.arrangements-with-blocks': 'word-arrangements',
  'count.arrangements-with-restrictions': 'word-arrangements',
  'count.counting-probability': 'count-prob',
  'stat.five-number-summary': 'five-number',
  'stat.outliers': 'five-number',
  'stat.ogive': 'histograms',
  'stat.frequency-from-cumulative': 'histograms',
  'stat.draw-histogram': 'histograms',
  'stat.skewness-from-graph': 'histograms',
  'stat.mean-standard-deviation': 'variance-sd',
  'stat.within-one-sd': 'variance-sd',
  'stat.grouped-data-mean': 'variance-sd',
  'stat.scatter-plot': 'scatter-ls',
  'stat.regression-line-calculator': 'scatter-ls',
  'stat.regression-predict': 'scatter-ls',
  'stat.regression-interpret-coefficients': 'scatter-ls',
  'stat.correlation-coefficient': 'correlation',
  'ageo.gradient-formula': 'lines',
  'ageo.line-equation': 'lines',
  'ageo.intersection-of-lines': 'lines',
  'ageo.distance-formula': 'midpoint-distance',
  'ageo.midpoint-formula': 'midpoint-distance',
  'ageo.inclination-angle': 'inclination',
  'ageo.parallel-perpendicular-gradients': 'inclination',
  'ageo.circle-equation': 'circles',
  'ageo.circle-intercepts': 'circles',
  'ageo.radius-equal-distances': 'circles',
  'ageo.circles-touching': 'circles',
  'ageo.circle-tangent-equation': 'tangents-circle',
  'ageo.parallelogram-fourth-vertex': 'collinear-proof',
  'ageo.reflect-in-y-equals-x': 'inverse',
  'trig.special-angles': 'special-angles',
  'trig.cast-quadrant-signs': 'special-angles',
  'trig.ratios-from-definition': 'right-tri',
  'trig.right-triangle-solve': 'right-tri',
  'trig.identity-simplify': 'basic-identities',
  'trig.sine-rule': 'oblique',
  'trig.cosine-rule': 'oblique',
  'trig.area-rule': 'area-rule',
  'trig.basic-graphs': 'trig-graphs-deg',
  'trig.graph-period': 'trig-graphs-deg',
  'trig.sketch-tan-graph': 'trig-graphs-deg',
  'trig.horizontal-shift': 'trig-graphs-deg',
  'trig.amplitude-range': 'trig-graphs-deg',
  'trig.undefined-values': 'trig-graphs-deg',
  'trig.reduction-formulae': 'reduction',
  'trig.compound-angle': 'sum-diff',
  'trig.double-angle': 'double-angle',
  'trig.general-solution': 'general-solution',
  'trig.3d-problem': 'trig-3d',
  'euc.acceptable-reasons': 'euc-revision',
  'euc.parallel-line-angles': 'euc-revision',
  'euc.midpoint-theorem': 'euc-revision',
  'euc.prove-theorem': 'euc-chords',
  'euc.circle-angle-theorems': 'euc-cyclic',
  'euc.cyclic-quad': 'euc-cyclic',
  'euc.tangent-chord-theorem': 'euc-tan-chord',
  'euc.tangents-from-point': 'euc-tan-chord',
  'euc.tangent-perpendicular-radius': 'euc-tan-chord',
  'euc.proportionality-theorem': 'euc-proportion',
  'euc.ratio-manipulation': 'euc-proportion',
  'euc.similar-triangles': 'euc-similar',
  'euc.area-ratio-triangles': 'euc-similar',
  'euc.converse-theorems': 'euc-circle-riders',
  'gen.rounding-precision': 'quad-formula',
};

function skillFile() {
  return JSON.parse(fs.readFileSync(path.join(BANK, 'taxonomy', 'skills.json'), 'utf8'));
}

function seed(db) {
  const topicIds = new Set(TOPICS.map(t => t.id));
  for (const [code, topicId] of Object.entries(SKILL_TOPIC)) {
    if (!topicIds.has(topicId)) throw new Error(`Skill ${code} maps to ${topicId}, which is not in the CAPS course.`);
  }
  const bank = skillFile();
  const missing = bank.skills.filter(s => s.syllabus !== false && !SKILL_TOPIC[s.id]).map(s => s.id);
  if (missing.length) throw new Error('Unmapped bank skills: ' + missing.join(', '));

  const now = Date.now();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS n FROM units').get().n;
  const insertUnit = db.prepare('INSERT OR IGNORE INTO units (id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const insertCourseUnit = db.prepare(`
    INSERT OR IGNORE INTO course_units (course_id, unit_id, name, position, required) VALUES (?, ?, ?, ?, 1)
  `);
  db.prepare(`
    INSERT OR IGNORE INTO courses (id, name, description, position, source, status, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'builtin', 'active', ?, ?)
  `).run(
    COURSE_ID,
    'Grade 12 Mathematics (CAPS)',
    'NSC Paper 1 and Paper 2, aimed at a distinction. Unit 0 (Grade 10–11 foundations) is part of the course and is always taught. Notes follow the CAPS exam guidelines. The content spine is Siyavula Everything Maths Grade 10–12 (CC BY), https://www.siyavula.com/read/za/mathematics/grade-12 . OpenStax is not used.',
    now, now,
  );
  UNITS.forEach(([id, name], i) => {
    insertUnit.run(id, name, maxPos + 1 + i, now, now);
    insertCourseUnit.run(COURSE_ID, id, name, i);
  });

  const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO topics
      (id, unit_id, name, pre, notes, paul, os, position, source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '', NULL, ?, 'caps', 'active', ?, ?)
  `);
  const homePos = new Map();
  for (const topic of TOPICS) {
    if (topic.existing) {
      const row = db.prepare('SELECT id FROM topics WHERE id = ?').get(topic.id);
      if (!row) throw new Error(`CAPS course reuses missing topic ${topic.id}.`);
      continue;
    }
    const pos = homePos.get(topic.unit) || 0;
    insertTopic.run(topic.id, topic.unit, topic.name, JSON.stringify(topic.pre || []), topic.notes || '', pos, now, now);
    homePos.set(topic.unit, pos + 1);
  }

  // Rewritten built-in text replaces the old text only where nobody has edited it.
  const refreshNotes = db.prepare('UPDATE topics SET notes = ?, updated_at = ? WHERE id = ? AND notes = ?');
  for (const topic of TOPICS) {
    for (const old of topic.oldNotes || []) refreshNotes.run(topic.notes, now, topic.id, old);
  }

  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO course_topics (course_id, unit_id, topic_id, position) VALUES (?, ?, ?, ?)
  `);
  const coursePos = new Map();
  for (const topic of TOPICS) {
    const pos = coursePos.get(topic.unit) || 0;
    insertMember.run(COURSE_ID, topic.unit, topic.id, pos);
    coursePos.set(topic.unit, pos + 1);
  }

  const insertKp = db.prepare('INSERT OR IGNORE INTO knowledge_points (id, topic_id, name, position) VALUES (?, ?, ?, ?)');
  const upsertMap = db.prepare(`
    INSERT INTO bank_skill_map (bank_code, topic_id, knowledge_point_id) VALUES (?, ?, ?)
    ON CONFLICT(bank_code) DO UPDATE SET
      topic_id = excluded.topic_id,
      knowledge_point_id = excluded.knowledge_point_id
  `);
  const byTopic = new Map();
  bank.skills.forEach((skill, i) => {
    if (skill.syllabus === false) return;
    const topicId = SKILL_TOPIC[skill.id];
    const list = byTopic.get(topicId) || [];
    list.push(skill);
    byTopic.set(topicId, list);
    const kp = 'kp-' + skill.id.replace(/\./g, '-');
    insertKp.run(kp, topicId, skill.name, i);
    upsertMap.run(skill.id, topicId, kp);
  });
  for (const topic of TOPICS) {
    if (byTopic.has(topic.id)) continue;
    const row = db.prepare('SELECT name FROM topics WHERE id = ?').get(topic.id);
    insertKp.run('kp-topic-' + topic.id, topic.id, row.name, 0);
  }
}

function outOfSyllabusSkills() {
  return skillFile().skills.filter(s => s.syllabus === false).map(s => s.id);
}

module.exports = { COURSE_ID, OFF_CAPS, UNITS, TOPICS, SKILL_TOPIC, seed, outOfSyllabusSkills };

