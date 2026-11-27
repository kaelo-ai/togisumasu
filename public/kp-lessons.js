/* Staged lesson text for knowledge points. A knowledge point teaches one or
   more small steps; each step has a short explanation, the reasons you will
   write (with their meaning), and worked examples from easy to harder, laid
   out as Statement | Reason. Loaded after caps-gen.js.

   Unit 0 geometry follows the order and the CAPS reason forms of Siyavula
   Everything Maths Grade 10, chapter 7 (CC BY 3.0, siyavula.com). The pacing
   (one idea, then several examples of rising difficulty) is modelled on Paul's
   Online Notes and OpenStax Contemporary Mathematics 10.2-10.3. The wording
   and the examples are our own. */
(function (root) {
  'use strict';
  const CapsGen = root.CapsGen || (typeof require === 'function' ? require('./caps-gen.js') : null);
  const FIG = CapsGen.FIG;

  const SIYAVULA = 'Siyavula Everything Maths Grade 10, ch. 7 (CC BY)';
  const OPENSTAX = 'OpenStax Contemporary Mathematics 10.2–10.3';
  const PAUL = "Paul's Online Notes (pacing of examples)";

  // Small teaching steps, each with its own explanation and worked examples.
  const STEPS = [
    {
      title: 'Angles on a line, round a point and vertically opposite',
      explain: `<p>An angle measures how far one line turns away from another, in degrees. We name an angle by its corner, the <b>vertex</b>: $\\hat B$ is the angle at $B$. When several angles share a corner, we use three letters with the vertex in the middle ($A\\hat BD$) or number them ($\\hat O_1$, $\\hat O_2$).</p>
<p>Three facts do most of the work:</p>
<ul><li>A full turn is $360^\\circ$, so the angles <b>round a point</b> add up to $360^\\circ$.</li>
<li>A straight line is half a turn, so angles sitting side by side <b>on a straight line</b> add up to $180^\\circ$.</li>
<li>When two straight lines cross, the angles directly <b>opposite</b> each other are equal. These are called <b>vertically opposite</b> angles. (“Vertically” refers to the shared vertex, not to up and down.)</li></ul>`,
      fig: () => FIG.cross(60, { 1: '1', 2: '2', 3: '3', 4: '4' }),
      figNote: '$\\hat O_1=\\hat O_3$ and $\\hat O_2=\\hat O_4$ (vertically opposite). $\\hat O_1+\\hat O_2=180^\\circ$ (on the straight line $AB$).',
      reasons: [['∠s on a str line', 'Angles on a straight line add up to 180°.'], ['∠s round a pt', 'Angles round a point add up to 360°.'], ['vert opp ∠s', 'Vertically opposite angles are equal.']],
      examples: [
        { level: 'Start here', fig: () => FIG.line(50, '130°', '?'),
          q: '$ABC$ is a straight line and $A\\hat BD=130^\\circ$. Find $D\\hat BC$.',
          rows: [['D\\hat BC=180^\\circ-130^\\circ=50^\\circ', '∠s on a str line']],
          answer: '$D\\hat BC=50^\\circ$' },
        { level: 'A step up', fig: () => FIG.cross(70, { 3: '70°', 1: '?', 2: '?' }),
          q: 'Straight lines $AB$ and $CD$ cross at $O$, and $A\\hat OC=70^\\circ$. Find $B\\hat OD$ and $A\\hat OD$.',
          rows: [['B\\hat OD=A\\hat OC=70^\\circ', 'vert opp ∠s'], ['A\\hat OD=180^\\circ-70^\\circ=110^\\circ', '∠s on a str line']],
          answer: '$B\\hat OD=70^\\circ$, $A\\hat OD=110^\\circ$',
          note: 'For $A\\hat OD$ the straight line is $CD$: $A\\hat OC$ and $A\\hat OD$ sit side by side on it.' },
        { level: 'With algebra', fig: () => FIG.cross(70, { 1: '2x+10°', 3: '3x−20°', 2: '?' }),
          q: 'Straight lines $AB$ and $CD$ cross at $O$. $\\hat O_1=2x+10^\\circ$ and $\\hat O_3=3x-20^\\circ$. Find $x$ and then $\\hat O_2$.',
          rows: [['3x-20^\\circ=2x+10^\\circ', 'vert opp ∠s'], ['x=30^\\circ', ''], ['\\hat O_1=2(30^\\circ)+10^\\circ=70^\\circ', ''], ['\\hat O_2=180^\\circ-70^\\circ=110^\\circ', '∠s on a str line']],
          answer: '$x=30^\\circ$, $\\hat O_2=110^\\circ$',
          note: 'Algebra steps need no reason. Only a geometry fact does.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'Parallel lines: corresponding, alternate and co-interior angles',
      explain: `<p><b>Parallel</b> lines run in the same direction and never meet. In a diagram they carry matching arrows, and we write $AB\\parallel CD$. A line that cuts across them is a <b>transversal</b>. It makes four angles at each crossing, and three kinds of pair matter:</p>
<ul><li><b>Corresponding angles</b> sit in the same position at each crossing (both above the line and to the right, say). Think of an F shape. They are equal.</li>
<li><b>Alternate angles</b> sit between the parallel lines, on opposite sides of the transversal. Think of a Z shape. They are equal.</li>
<li><b>Co-interior angles</b> sit between the parallel lines, on the same side of the transversal. Think of a C or U shape. They add up to $180^\\circ$.</li></ul>
<p>These facts are only true because the lines are parallel, so the reason must name the parallel lines, for example “alt ∠s; $AB\\parallel CD$”. They also work backwards: if alternate (or corresponding) angles are equal, or co-interior angles add up to $180^\\circ$, the lines are parallel.</p>`,
      fig: () => FIG.parallel(60, [['EGB', 'a', { r: 14 }], ['GHD', 'a', { r: 14 }], ['BGH', 'b', { r: 14 }], ['CHG', 'b', { r: 14 }]]),
      figNote: 'The two angles marked $a$ are corresponding (same position at each crossing). The two marked $b$ are alternate (between the lines, on opposite sides of $EF$). $B\\hat GH$ and $G\\hat HD$ are co-interior (between the lines, same side), so $a+b=180^\\circ$.',
      reasons: [['corresp ∠s; AB ∥ CD', 'Corresponding angles are equal because AB ∥ CD.'], ['alt ∠s; AB ∥ CD', 'Alternate angles are equal because AB ∥ CD.'], ['co-int ∠s; AB ∥ CD', 'Co-interior angles add up to 180° because AB ∥ CD.']],
      examples: [
        { level: 'Start here', fig: () => FIG.parallel(65, [['EGB', '65°'], ['GHD', '?']]),
          q: '$AB\\parallel CD$ and $EF$ cuts $AB$ at $G$ and $CD$ at $H$. $E\\hat GB=65^\\circ$. Find $G\\hat HD$.',
          rows: [['G\\hat HD=E\\hat GB=65^\\circ', 'corresp ∠s; AB ∥ CD']],
          answer: '$G\\hat HD=65^\\circ$',
          note: 'Both angles are above their parallel line and to the right of $EF$: the same position, so corresponding.' },
        { level: 'A step up', fig: () => FIG.parallel(115, [['AGH', '115°'], ['GHD', '?'], ['CHG', '?']]),
          q: '$AB\\parallel CD$ and $A\\hat GH=115^\\circ$. Find $G\\hat HD$ and $G\\hat HC$.',
          rows: [['G\\hat HD=A\\hat GH=115^\\circ', 'alt ∠s; AB ∥ CD'], ['G\\hat HC=180^\\circ-115^\\circ=65^\\circ', 'co-int ∠s; AB ∥ CD']],
          answer: '$G\\hat HD=115^\\circ$, $G\\hat HC=65^\\circ$',
          note: '$G\\hat HC$ could also come from $G\\hat HD$ with “∠s on a str line”. Either reason is accepted.' },
        { level: 'With algebra', fig: () => FIG.parallel(92, [['BGH', '2x+20°'], ['GHD', '3x−10°']]),
          q: '$AB\\parallel CD$. $B\\hat GH=2x+20^\\circ$ and $G\\hat HD=3x-10^\\circ$. Find $x$ and both angles.',
          rows: [['(2x+20^\\circ)+(3x-10^\\circ)=180^\\circ', 'co-int ∠s; AB ∥ CD'], ['5x=170^\\circ,\\ x=34^\\circ', ''], ['B\\hat GH=88^\\circ,\\ G\\hat HD=92^\\circ', '']],
          answer: '$x=34^\\circ$',
          note: 'Check: $88^\\circ+92^\\circ=180^\\circ$.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'The angle sum and exterior angle of a triangle',
      explain: `<p>The three angles inside any triangle add up to $180^\\circ$. You can see why with the last lesson: draw a line through the top corner parallel to the base. The two base angles reappear at the top as alternate angles, and the three angles now sit on a straight line.</p>
<p>If you extend one side of a triangle, the angle between the extension and the next side is an <b>exterior angle</b>. It equals the sum of the two inside angles that are <b>not</b> next to it (the <b>interior opposite angles</b>). That is because the exterior angle and its neighbour make $180^\\circ$ on the straight line, and so do the neighbour and the other two angles.</p>`,
      fig: () => FIG.tri(65, 55, { ext: true, arcs: [['BAC', 'a'], ['ABC', 'b'], ['ACD', 'a+b']] }),
      figNote: 'With $BC$ extended to $D$: $A\\hat CD=\\hat A+\\hat B$.',
      reasons: [['sum of ∠s in △', 'The three angles of a triangle add up to 180°.'], ['ext ∠ of △', 'An exterior angle of a triangle equals the sum of the two interior opposite angles.']],
      examples: [
        { level: 'Start here', fig: () => FIG.tri(77, 55, { arcs: [['BAC', '48°'], ['ABC', '77°'], ['ACB', '?']] }),
          q: 'In $\\triangle ABC$, $\\hat A=48^\\circ$ and $\\hat B=77^\\circ$. Find $\\hat C$.',
          rows: [['\\hat C=180^\\circ-48^\\circ-77^\\circ=55^\\circ', 'sum of ∠s in △']],
          answer: '$\\hat C=55^\\circ$' },
        { level: 'A step up', fig: () => FIG.tri(65, 75, { ext: true, names: { A: 'P', B: 'Q', C: 'R', D: 'S' }, arcs: [['BAC', '40°'], ['ABC', '65°'], ['ACD', '?']] }),
          q: 'In $\\triangle PQR$, $QR$ is extended to $S$. $\\hat P=40^\\circ$ and $\\hat Q=65^\\circ$. Find $P\\hat RS$.',
          rows: [['P\\hat RS=40^\\circ+65^\\circ=105^\\circ', 'ext ∠ of △']],
          answer: '$P\\hat RS=105^\\circ$',
          note: 'Check the long way: $P\\hat RQ=180^\\circ-40^\\circ-65^\\circ=75^\\circ$, and $180^\\circ-75^\\circ=105^\\circ$ on the straight line.' },
        { level: 'With algebra', fig: () => FIG.tri(50, 100, { ext: true, arcs: [['BAC', 'x'], ['ABC', 'x+20°'], ['ACD', '3x−10°']] }),
          q: 'In $\\triangle ABC$, $BC$ is extended to $D$. $\\hat A=x$, $\\hat B=x+20^\\circ$ and $A\\hat CD=3x-10^\\circ$. Find $x$.',
          rows: [['3x-10^\\circ=x+(x+20^\\circ)', 'ext ∠ of △'], ['x=30^\\circ', '']],
          answer: '$x=30^\\circ$',
          note: 'Check: $\\hat A=30^\\circ$, $\\hat B=50^\\circ$, $A\\hat CD=80^\\circ=30^\\circ+50^\\circ$.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'Isosceles and equilateral triangles',
      explain: `<p>An <b>isosceles</b> triangle has <b>two</b> equal sides. The diagram marks them with the same tick. The angles <b>opposite</b> the equal sides are equal. “Opposite” means across the triangle from the side, not touching it: side $AB$ is opposite $\\hat C$, and side $AC$ is opposite $\\hat B$. These two equal angles are often called the base angles.</p>
<p>It works backwards too: if two angles of a triangle are equal, the sides opposite them are equal, so the triangle is isosceles.</p>
<p>An <b>equilateral</b> triangle has all <b>three</b> sides equal, so all three angles are equal: $180^\\circ\\div 3=60^\\circ$ each. Every equilateral triangle is also isosceles, but most isosceles triangles are not equilateral.</p>`,
      fig: () => FIG.tri(65, 65, { ticks: [['AB', 1], ['AC', 1]], arcs: [['ABC', '', { r: 18 }], ['ACB', '', { r: 18 }]] }),
      figNote: '$AB=AC$ (one tick each), so $\\hat B=\\hat C$ (one arc each).',
      reasons: [['∠s opp equal sides', 'In a triangle, the angles opposite equal sides are equal.'], ['sides opp equal ∠s', 'In a triangle, the sides opposite equal angles are equal.'], ['sum of ∠s in △', 'The three angles of a triangle add up to 180°.']],
      examples: [
        { level: 'Start here', fig: () => FIG.tri(70, 70, { ticks: [['AB', 1], ['AC', 1]], arcs: [['ABC', '70°'], ['ACB', '?'], ['BAC', '?']] }),
          q: 'In $\\triangle ABC$, $AB=AC$ and $\\hat B=70^\\circ$. Find $\\hat C$ and $\\hat A$.',
          rows: [['\\hat C=\\hat B=70^\\circ', '∠s opp equal sides'], ['\\hat A=180^\\circ-70^\\circ-70^\\circ=40^\\circ', 'sum of ∠s in △']],
          answer: '$\\hat C=70^\\circ$, $\\hat A=40^\\circ$',
          note: '$\\hat C$ is opposite $AB$ and $\\hat B$ is opposite $AC$. Those sides are equal, so those angles are equal.' },
        { level: 'A step up', fig: () => FIG.tri(72, 72, { names: { A: 'P', B: 'Q', C: 'R' }, ticks: [['AB', 1], ['AC', 1]], arcs: [['BAC', '36°'], ['ABC', '?']] }),
          q: 'In $\\triangle PQR$, $PQ=PR$ and $\\hat P=36^\\circ$. Find $\\hat Q$.',
          rows: [['\\hat Q=\\hat R', '∠s opp equal sides'], ['\\hat Q+\\hat R=180^\\circ-36^\\circ=144^\\circ', 'sum of ∠s in △'], ['\\hat Q=144^\\circ\\div 2=72^\\circ', '']],
          answer: '$\\hat Q=72^\\circ$',
          note: 'This time you know the angle between the equal sides, so split what is left equally between the other two.' },
        { level: 'Two triangles', fig: () => FIG.isoPair(70, { B: '70°', C: '?' }),
          q: '$D$ lies on $BC$ with $AB=AD$ and $AD=DC$. $\\hat B=70^\\circ$. Find $\\hat C$.',
          rows: [['A\\hat DB=\\hat B=70^\\circ', '∠s opp equal sides; AB = AD'], ['A\\hat DC=180^\\circ-70^\\circ=110^\\circ', '∠s on a str line'], ['D\\hat AC=\\hat C', '∠s opp equal sides; AD = DC'], ['\\hat C=(180^\\circ-110^\\circ)\\div 2=35^\\circ', 'sum of ∠s in △']],
          answer: '$\\hat C=35^\\circ$',
          note: 'A shorter route: $A\\hat DB$ is an exterior angle of $\\triangle ADC$, so $70^\\circ=D\\hat AC+\\hat C=2\\hat C$ (ext ∠ of △).' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'Congruent triangles: SSS, SAS, AAS and RHS',
      explain: `<p>Two triangles are <b>congruent</b> when one is an exact copy of the other: same size and same shape, so all three sides and all three angles match. We write $\\triangle ABC\\equiv\\triangle DEF$. The order of the letters matters: $A$ matches $D$, $B$ matches $E$ and $C$ matches $F$.</p>
<p>You never need to check all six parts. Any one of these four tests is enough:</p>
<ul><li><b>SSS</b> (side, side, side): all three sides match.</li>
<li><b>SAS</b> (side, angle, side): two sides match, and so does the angle <b>between</b> them (the included angle).</li>
<li><b>AAS</b> (angle, angle, side): two angles match, and one side in the same position matches.</li>
<li><b>RHS</b> (right angle, hypotenuse, side): both triangles have a $90^\\circ$ angle, their hypotenuses match (the longest side, opposite the right angle), and one other side matches.</li></ul>
<p>Two patterns do <b>not</b> prove congruence. Three equal angles (AAA) fix the shape but not the size. Two sides with an angle that is not between them can fit two different triangles, unless the angle is $90^\\circ$, which is RHS.</p>
<p>Once two triangles are congruent, every other matching side and angle is equal too. That is usually why you prove it.</p>`,
      fig: () => FIG.kite(),
      figNote: 'Matching ticks show equal sides: $AB=AD$ and $CB=CD$. The side $AC$ belongs to both triangles.',
      reasons: [['SSS / SAS / AAS / RHS', 'Name the test after the congruence statement. CAPS also accepts S∠S, ∠∠S and 90°HS.'], ['common', 'A side shared by both triangles is equal to itself.'], ['≡△s', 'Matching parts of congruent triangles are equal.']],
      examples: [
        { level: 'SSS', fig: () => FIG.kite(),
          q: 'In quadrilateral $ABCD$, $AB=AD$ and $CB=CD$. Prove that $\\triangle ABC\\equiv\\triangle ADC$, and then that $\\hat B=\\hat D$.',
          rows: [['AB=AD', 'given'], ['CB=CD', 'given'], ['AC=AC', 'common'], ['\\triangle ABC\\equiv\\triangle ADC', 'SSS'], ['\\hat B=\\hat D', '≡△s']],
          answer: '$\\triangle ABC\\equiv\\triangle ADC$ (SSS), so $\\hat B=\\hat D$' },
        { level: 'SAS', fig: () => CapsGen.FIG.bowtie({ ticks: [['AC', 1], ['CE', 1], ['BC', 2], ['CD', 2]] }),
          q: '$AE$ and $BD$ cross at $C$, with $AC=CE$ and $BC=CD$. Prove that $\\triangle ABC\\equiv\\triangle EDC$.',
          rows: [['AC=EC', 'given'], ['A\\hat CB=E\\hat CD', 'vert opp ∠s'], ['BC=DC', 'given'], ['\\triangle ABC\\equiv\\triangle EDC', 'SAS']],
          answer: '$\\triangle ABC\\equiv\\triangle EDC$ (SAS)',
          note: 'The angle at $C$ sits between the two equal sides in each triangle. That is what makes it SAS.' },
        { level: 'AAS', fig: () => CapsGen.FIG.bowtie({ ticks: [['BC', 1], ['CD', 1]], arrows: [['AB', 1], ['DE', 1]] }),
          q: '$AE$ and $BD$ cross at $C$, $AB\\parallel DE$ and $BC=CD$. Prove that $\\triangle ABC\\equiv\\triangle EDC$, and then that $AB=ED$.',
          rows: [['A\\hat BC=E\\hat DC', 'alt ∠s; AB ∥ DE'], ['A\\hat CB=E\\hat CD', 'vert opp ∠s'], ['BC=DC', 'given'], ['\\triangle ABC\\equiv\\triangle EDC', 'AAS'], ['AB=ED', '≡△s']],
          answer: '$\\triangle ABC\\equiv\\triangle EDC$ (AAS), so $AB=ED$' },
        { level: 'RHS', fig: () => FIG.isoAltitude(),
          q: 'In $\\triangle ABC$, $AB=AC$ and $AD\\perp BC$ with $D$ on $BC$. Prove that $BD=DC$.',
          rows: [['A\\hat DB=A\\hat DC=90^\\circ', 'given'], ['AB=AC', 'given'], ['AD=AD', 'common'], ['\\triangle ADB\\equiv\\triangle ADC', 'RHS'], ['BD=DC', '≡△s']],
          answer: '$BD=DC$',
          note: '$AB$ and $AC$ are the hypotenuses: each is opposite the right angle in its triangle.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'Properties of quadrilaterals',
      explain: `<p>A quadrilateral has four sides. A diagonal splits it into two triangles, so its angles add up to $2\\times180^\\circ=360^\\circ$. The special ones form a family, and each inherits everything from the one above it:</p>
<ul><li><b>Parallelogram</b>: both pairs of opposite sides are parallel. Then the opposite sides are equal, the opposite angles are equal, and the diagonals <b>bisect</b> each other (cut each other in half).</li>
<li><b>Rectangle</b>: a parallelogram with right angles. Its diagonals are also equal in length.</li>
<li><b>Rhombus</b>: a parallelogram with all four sides equal. Its diagonals cross at $90^\\circ$ and cut the corner angles in half.</li>
<li><b>Square</b>: a rectangle and a rhombus at once, so it has every property above.</li>
<li><b>Kite</b>: two pairs of equal sides that sit next to each other. Its diagonals cross at $90^\\circ$, and the angles between the unequal sides are equal.</li></ul>
<p>In reasons, “||m” is short for parallelogram.</p>`,
      fig: () => FIG.para({ diag: 'O', arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]], ticks: [['AO', 1], ['OC', 1], ['BO', 2], ['OD', 2]] }),
      figNote: 'Parallelogram $ABCD$: matching arrows mark the parallel sides. The diagonals bisect each other at $O$.',
      reasons: [['opp sides of ||m', 'Opposite sides of a parallelogram are equal.'], ['opp ∠s of ||m', 'Opposite angles of a parallelogram are equal.'], ['diags of ||m', 'The diagonals of a parallelogram bisect each other.'], ['diags of rhombus', 'The diagonals of a rhombus are perpendicular and bisect the corner angles.'], ['diags of rect', 'The diagonals of a rectangle are equal in length.'], ['sum of ∠s in quad', 'The angles of a quadrilateral add up to 360°.']],
      examples: [
        { level: 'Start here', fig: () => FIG.para({ arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]], arcs: [['BAD', '112°'], ['DCB', '?'], ['CBA', '?']], skew: 110 / Math.tan(112 * Math.PI / 180) }),
          q: '$ABCD$ is a parallelogram with $\\hat A=112^\\circ$ and $AB=7$ cm. Find $\\hat C$, $\\hat B$ and $CD$.',
          rows: [['\\hat C=\\hat A=112^\\circ', 'opp ∠s of ||m'], ['\\hat B=180^\\circ-112^\\circ=68^\\circ', 'co-int ∠s; AD ∥ BC'], ['CD=AB=7\\text{ cm}', 'opp sides of ||m']],
          answer: '$\\hat C=112^\\circ$, $\\hat B=68^\\circ$, $CD=7$ cm' },
        { level: 'A step up', fig: () => FIG.para({ diag: 'T', names: { A: 'P', B: 'Q', C: 'R', D: 'S' }, arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]] }),
          q: '$PQRS$ is a parallelogram with diagonals meeting at $T$. $PT=2x+1$, $TR=x+5$ and $QS=14$ (all in cm). Find $x$, $PR$ and $QT$.',
          rows: [['2x+1=x+5', 'diags of ||m'], ['x=4,\\ PT=TR=9', ''], ['PR=18\\text{ cm}', ''], ['QT=\\tfrac12 QS=7\\text{ cm}', 'diags of ||m']],
          answer: '$x=4$, $PR=18$ cm, $QT=7$ cm' },
        { level: 'Rhombus', fig: () => FIG.rhombus({ t: 32, arcs: [['ABO', '32°'], ['BAO', '?'], ['ADC', '?']], rights: ['AOB'] }),
          q: '$ABCD$ is a rhombus with diagonals meeting at $O$, and $A\\hat BO=32^\\circ$. Find $B\\hat AO$ and $A\\hat DC$.',
          rows: [['A\\hat OB=90^\\circ', 'diags of rhombus'], ['B\\hat AO=180^\\circ-90^\\circ-32^\\circ=58^\\circ', 'sum of ∠s in △'], ['A\\hat BC=2\\times32^\\circ=64^\\circ', 'diags of rhombus'], ['A\\hat DC=A\\hat BC=64^\\circ', 'opp ∠s of ||m']],
          answer: '$B\\hat AO=58^\\circ$, $A\\hat DC=64^\\circ$',
          note: 'A rhombus is a parallelogram, so the parallelogram reasons still apply.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
    {
      title: 'The midpoint theorem and its converse',
      explain: `<p>The <b>midpoint</b> of a side is the point halfway along it. The <b>midpoint theorem</b> says: in any triangle, the line joining the midpoints of two sides is <b>parallel</b> to the third side and <b>half</b> as long.</p>
<p>The <b>converse</b> runs the other way: a line through the midpoint of one side, drawn parallel to a second side, meets the third side at its midpoint.</p>
<p>Grade 12 proofs use both, often together with the parallel-line angles from earlier in this unit.</p>`,
      fig: () => FIG.midpoint({ arrows: [['DE', 1], ['BC', 1]] }),
      figNote: '$D$ and $E$ are midpoints (matching ticks), so $DE\\parallel BC$ and $DE=\\tfrac12 BC$.',
      reasons: [['midpt theorem', 'The line joining the midpoints of two sides of a triangle is parallel to the third side and half its length.'], ['converse midpt theorem', 'A line through the midpoint of one side, parallel to a second side, bisects the third side.']],
      examples: [
        { level: 'Start here', fig: () => FIG.midpoint(),
          q: 'In $\\triangle ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$, and $BC=14$ cm. Find $DE$.',
          rows: [['DE=\\tfrac12 BC=\\tfrac12(14)=7\\text{ cm}', 'midpt theorem']],
          answer: '$DE=7$ cm' },
        { level: 'A step up', fig: () => FIG.midpoint({ b: 64, arcs: [['ABC', '64°'], ['ADE', '?']] }),
          q: 'In $\\triangle ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$, and $A\\hat BC=64^\\circ$. Find $A\\hat DE$.',
          rows: [['DE\\parallel BC', 'midpt theorem'], ['A\\hat DE=A\\hat BC=64^\\circ', 'corresp ∠s; DE ∥ BC']],
          answer: '$A\\hat DE=64^\\circ$',
          note: 'You must state $DE\\parallel BC$ first. The angle fact depends on it.' },
        { level: 'The converse', fig: () => FIG.midpoint({ names: { A: 'P', B: 'Q', C: 'R', D: 'S', E: 'T' }, noTicks: true, ticks: [['AD', 1], ['DB', 1]], arrows: [['DE', 1], ['BC', 1]] }),
          q: 'In $\\triangle PQR$, $S$ is the midpoint of $PQ$. A line through $S$ parallel to $QR$ meets $PR$ at $T$. $PT=5$ cm and $ST=4$ cm. Find $PR$ and $QR$.',
          rows: [['PT=TR', 'converse midpt theorem'], ['PR=2(5)=10\\text{ cm}', ''], ['ST=\\tfrac12 QR', 'midpt theorem'], ['QR=2(4)=8\\text{ cm}', '']],
          answer: '$PR=10$ cm, $QR=8$ cm',
          note: 'Once the converse shows $T$ is a midpoint, $S$ and $T$ are both midpoints, so the theorem itself applies.' },
      ],
      sources: [SIYAVULA, OPENSTAX, PAUL],
    },
  ];

  // Key words and a memory tip for each step, shown as a word box before the
  // explanation and a "Remember" note after the reasons.
  const NOTEBOOK = [
    { words: [
        ['angle', 'the amount of turn between two lines that meet at a point, the vertex. We measure it in degrees (°).'],
        ['straight line', 'a half turn, $180^\\circ$. Angles that sit side by side on it add up to $180^\\circ$.'],
        ['vertically opposite angles', 'the angles facing each other across the point where two straight lines cross.'],
      ],
      tip: 'Draw an X. The two angles that face each other across the middle are always equal, and any two angles next to each other make a straight line, so they add up to $180^\\circ$.' },
    { words: [
        ['parallel lines', 'lines that never meet, like the rails of a train track. Arrows on the lines mark them.'],
        ['transversal', 'a line that cuts across two or more other lines.'],
      ],
      tip: 'Look for a letter. <b>F</b> shape: corresponding angles, equal. <b>Z</b> shape: alternate angles, equal. <b>C</b> (or U) shape: co-interior angles, add up to $180^\\circ$. These only work when the lines are parallel.' },
    { words: [
        ['interior angle', 'an angle inside the triangle, at one of its corners.'],
        ['exterior angle', 'the angle outside the triangle between one side and the next side extended past the corner.'],
        ['interior opposite angles', 'the two inside angles that are not next to the exterior angle.'],
      ],
      tip: 'Inside: all three add up to $180^\\circ$. Outside: the exterior angle equals the two far-away inside angles added together.' },
    { words: [
        ['isosceles triangle', 'a triangle with <b>two</b> equal sides.'],
        ['equilateral triangle', 'a triangle with all <b>three</b> sides equal.'],
        ['base angles', 'the two equal angles of an isosceles triangle, opposite the equal sides.'],
      ],
      tip: '“Isosceles” comes from Greek for “equal legs”: two equal sides, like a pair of legs. “Equi-lateral” means “equal sides”: all of them. Equal sides always face equal angles.' },
    { words: [
        ['congruent', 'exactly the same shape and size: one triangle would fit exactly on top of the other. Symbol: $\\equiv$.'],
        ['included angle', 'the angle between two given sides, where they meet.'],
        ['hypotenuse', 'the longest side of a right-angled triangle, opposite the $90^\\circ$ angle.'],
      ],
      tip: 'Read the letters as a list of what matches: S = a side, A = an angle, R = a right angle, H = the hypotenuse. In SAS the A must sit <b>between</b> the two S’s. AAA proves nothing about size: a photo and its enlargement have the same angles.' },
    { words: [
        ['quadrilateral', 'any shape with four straight sides.'],
        ['parallelogram', 'a quadrilateral with both pairs of opposite sides parallel.'],
        ['diagonal', 'a line joining two opposite corners.'],
        ['bisect', 'cut into two equal parts.'],
      ],
      tip: 'Each special shape is a parallelogram with something extra: a rectangle adds right angles, a rhombus adds equal sides, and a square has both. So a square is a rectangle and a rhombus at the same time.' },
    { words: [
        ['midpoint', 'the point exactly halfway along a line segment.'],
        ['converse', 'the theorem turned around: what was given becomes what you prove.'],
      ],
      tip: 'Join two midpoints and you get a line that is parallel to the third side and exactly half as long. Remember it as “midpoints: parallel and half”.' },
  ];
  STEPS.forEach((s, i) => Object.assign(s, NOTEBOOK[i]));

  // The topic's three knowledge points stay as they are; each one teaches
  // a run of the steps above before its practice starts.
  const EUC = [
    { title: 'Isosceles triangles and the angle sum', steps: STEPS.slice(0, 4) },
    { title: 'Congruence conditions', steps: STEPS.slice(4, 6) },
    { title: 'The midpoint theorem', steps: STEPS.slice(6, 7) },
  ];

  const GR12 = root.KpLessonsGr12 || (typeof require === 'function' ? require('./kp-lessons-gr12.js') : {});
  const LESSONS = Object.assign({ 'euc-revision': EUC }, GR12);
  function get(topicId, position) {
    const list = LESSONS[topicId];
    return list && list[position] ? list[position] : null;
  }
  const KpLessons = { LESSONS, get };
  if (typeof module !== 'undefined' && module.exports) module.exports = KpLessons;
  root.KpLessons = KpLessons;
})(typeof globalThis !== 'undefined' ? globalThis : this);
