/* Grade 12 Euclidean geometry lessons: circles and similar triangles.
   Same shape as the Unit 0 lessons: key words, a short explanation, a marked
   diagram, the reasons you will write with their meaning, worked examples
   from easy to harder as Statement | Reason, and a memory tip.

   The order of ideas and the CAPS reason forms follow Siyavula Everything
   Maths Grade 11 and 12, Euclidean geometry (CC BY 3.0, siyavula.com). The
   define-prove-then-examples rhythm is modelled on CK-12 Geometry ch. 9, the
   advice on writing each line of a proof on Book of Proof (R. Hammack), the
   pacing of examples on Paul's Online Notes. All wording, figures and examples
   are our own. Loaded after caps-gen.js and before kp-lessons.js. */
(function (root) {
  'use strict';
  const CapsGen = root.CapsGen || (typeof require === 'function' ? require('./caps-gen.js') : null);
  const FIG = CapsGen.FIG;
  const SIYAVULA = 'Siyavula Everything Maths Grade 11–12, Euclidean geometry (CC BY)';
  const CK12 = 'CK-12 Geometry ch. 9 (order: define, prove, then examples)';
  const BOP = 'Book of Proof, R. Hammack (writing each line of a proof)';
  const PAUL = "Paul's Online Notes (pacing of examples)";
  const SRC = [SIYAVULA, CK12, PAUL];
  const R = {
    perpChord: ['line from centre ⊥ to chord', 'A line from the centre of a circle perpendicular to a chord cuts the chord in half.'],
    midChord: ['line from centre to midpt of chord', 'The line from the centre to the midpoint of a chord is perpendicular to the chord.'],
    radii: ['radii', 'All radii of the same circle are equal.'],
    pyth: ['Pythagoras', 'In a right-angled triangle, the hypotenuse squared equals the sum of the squares of the other two sides.'],
    centre: ['∠ at centre = 2 × ∠ at circum', 'The angle at the centre is twice the angle at the circumference standing on the same arc.'],
    semi: ['∠ in semi-circle', 'An angle at the circumference standing on a diameter is 90°.'],
    seg: ['∠s in the same seg', 'Angles at the circumference standing on the same arc, on the same side of it, are equal.'],
    oppCyc: ['opp ∠s of cyclic quad', 'The opposite angles of a cyclic quadrilateral add up to 180°.'],
    extCyc: ['ext ∠ of cyclic quad', 'An exterior angle of a cyclic quadrilateral equals the interior angle opposite it.'],
    convCyc: ['opp ∠s of quad suppl', 'If the opposite angles of a quadrilateral add up to 180°, the quadrilateral is cyclic.'],
    tanRad: ['tan ⊥ radius', 'A tangent is perpendicular to the radius at the point of contact.'],
    tans: ['tans from common pt', 'Two tangents drawn from the same outside point are equal in length.'],
    tanChord: ['tan chord theorem', 'The angle between a tangent and a chord equals the angle in the alternate segment.'],
    isos: ['∠s opp equal sides', 'In a triangle, the angles opposite equal sides are equal.'],
    sum: ['sum of ∠s in △', 'The three angles of a triangle add up to 180°.'],
    quad: ['sum of ∠s in quad', 'The four angles of a quadrilateral add up to 360°.'],
    aaa: ['∠∠∠', 'If the three angles of one triangle equal the three angles of another, the triangles are similar.'],
    simS: ['|||△s', 'In similar triangles the corresponding angles are equal and the corresponding sides are in the same ratio.'],
    corr: ['corresp ∠s', 'Where a line crosses two parallel lines, the angles in matching positions are equal.'],
    common: ['common', 'The same side or angle belongs to both triangles.'],
    mid: ['midpt theorem', 'The line joining the midpoints of two sides of a triangle is parallel to the third side and half as long.'],
  };

  const L = {};

  L['euc-chords'] = [
    { title: 'The perpendicular from the centre bisects a chord', steps: [{
      title: 'A line from the centre at 90° cuts a chord in half',
      words: [
        ['chord', 'a straight line joining two points on a circle. The longest chords pass through the centre: they are diameters.'],
        ['radius', 'a line from the centre to the circle. All radii of one circle are equal (plural: radii).'],
        ['perpendicular (⊥)', 'meeting at $90^\\circ$. A small square in a diagram marks it.'],
        ['bisect', 'cut into two equal parts.'],
      ],
      explain: `<p>Draw a chord $AB$ and drop a line from the centre $O$ that meets it at $90^\\circ$ at $M$. Then $M$ is exactly halfway along the chord: $AM=MB$.</p>
<p><b>Why:</b> join $OA$ and $OB$. Both are radii, $OM$ is shared, and both triangles have a right angle at $M$, so $\\triangle OMA\\equiv\\triangle OMB$ (RHS). Matching sides are equal, so $AM=MB$. In the exam you may be asked to write this proof out: that is called <b>bookwork</b>, proving a theorem from the textbook.</p>
<p>Most questions then use <b>Pythagoras</b> in $\\triangle OMA$: radius, half the chord and the distance $OM$ make a right-angled triangle.</p>`,
      fig: () => FIG.chord({ oa: true, ob: true, ticks: true }),
      figNote: '$OM\\perp AB$ (square at $M$), so $AM=MB$ (one tick each).',
      reasons: [R.perpChord, R.pyth, R.radii],
      examples: [
        { level: 'Start here', fig: () => FIG.chord({ oa: true, lens: [['OA', '10'], ['AB', '16'], ['OM', '?']] }),
          q: '$O$ is the centre and $OM\\perp AB$. $OA=10$ cm and $AB=16$ cm. Find $OM$.',
          rows: [['AM=\\tfrac12 AB=8\\text{ cm}', 'line from centre ⊥ to chord'], ['OM^2=10^2-8^2=36', 'Pythagoras'], ['OM=6\\text{ cm}', '']],
          answer: '$OM=6$ cm', note: 'Halve the chord first. Pythagoras needs half the chord, not the whole chord.' },
        { level: 'A step up', fig: () => FIG.chord({ oa: true, lens: [['OA', '13'], ['OM', '5'], ['AB', '?']] }),
          q: 'The radius is $13$ cm, $OM\\perp AB$ and $OM=5$ cm. Find the chord $AB$.',
          rows: [['AM^2=13^2-5^2=144', 'Pythagoras'], ['AM=12\\text{ cm}', ''], ['AB=2\\times12=24\\text{ cm}', 'line from centre ⊥ to chord']],
          answer: '$AB=24$ cm', note: 'Pythagoras gives half the chord. Double it at the end.' },
        { level: 'With algebra', fig: () => FIG.chord({ oa: true, lens: [['OA', 'x+2'], ['OM', 'x'], ['AB', '8']] }),
          q: '$OM\\perp AB$, $OM=x$ cm, the radius is $(x+2)$ cm and $AB=8$ cm. Find $x$.',
          rows: [['AM=4\\text{ cm}', 'line from centre ⊥ to chord'], ['(x+2)^2=x^2+4^2', 'Pythagoras'], ['x^2+4x+4=x^2+16', ''], ['4x=12,\\ x=3', '']],
          answer: '$x=3$ (so $OM=3$ cm and the radius is $5$ cm)', note: 'The $x^2$ terms cancel, leaving a simple equation.' },
        { level: 'Two chords', fig: () => FIG.twoChords(25, 7, 15, false),
          q: '$AB\\parallel CD$ are chords on opposite sides of the centre $O$ of a circle with radius $25$ cm. $AB=48$ cm and $CD=40$ cm. Find the distance between the chords.',
          rows: [['AM=24,\\ OM=\\sqrt{25^2-24^2}=7', 'line from centre ⊥ to chord; Pythagoras'], ['CN=20,\\ ON=\\sqrt{25^2-20^2}=15', 'line from centre ⊥ to chord; Pythagoras'], ['MN=7+15=22\\text{ cm}', '']],
          answer: '$22$ cm', note: 'Chords on the same side of the centre: subtract the distances instead of adding.' },
        { level: 'The proof (bookwork)', fig: () => FIG.chord({ oa: true, ob: true }),
          q: 'Prove that if $OM\\perp AB$, then $AM=MB$.',
          rows: [['OA=OB', 'radii'], ['OM=OM', 'common'], ['O\\hat MA=O\\hat MB=90^\\circ', 'given'], ['\\triangle OMA\\equiv\\triangle OMB', 'RHS'], ['AM=MB', '≡△s']],
          answer: '$AM=MB$', note: 'Each line has a reason. The congruence comes last because it needs the three facts above it.' },
      ],
      tip: 'Radius, half the chord and the line from the centre always make a right-angled triangle. Spot it, then use Pythagoras.',
      sources: SRC.concat([BOP]),
    }] },
    { title: 'The line from the centre to the midpoint of a chord', steps: [{
      title: 'The line from the centre to a chord’s midpoint is at 90°',
      words: [
        ['midpoint', 'the point exactly halfway along a line segment.'],
        ['converse', 'a theorem turned around: what was given becomes what you prove. This theorem is the converse of the last one.'],
      ],
      explain: `<p>This is the last theorem turned around. If $M$ is the <b>midpoint</b> of chord $AB$, then the line from the centre to $M$ is perpendicular to the chord: $OM\\perp AB$.</p>
<p>So you have two reasons that look alike. Choose by what you were told:</p>
<ul><li>told the line is <b>perpendicular</b> → it halves the chord (line from centre ⊥ to chord);</li>
<li>told $M$ is the <b>midpoint</b> → the line is perpendicular (line from centre to midpt of chord).</li></ul>`,
      fig: () => FIG.chord({ oa: true, ob: true, ticks: true, right: false }),
      figNote: '$AM=MB$ (one tick each), so $OM\\perp AB$.',
      reasons: [R.midChord, R.radii, R.pyth, R.sum],
      examples: [
        { level: 'Start here', fig: () => FIG.chord({ a1: 215, a2: 325, oa: true, ticks: true, right: false, arcs: [['OAM', '35°'], ['AOM', '?']] }),
          q: '$M$ is the midpoint of chord $AB$ and $O\\hat AM=35^\\circ$. Find $A\\hat OM$.',
          rows: [['OM\\perp AB', 'line from centre to midpt of chord'], ['A\\hat OM=180^\\circ-90^\\circ-35^\\circ=55^\\circ', 'sum of ∠s in △']],
          answer: '$A\\hat OM=55^\\circ$', note: 'The right angle is not marked: you earn it from the midpoint.' },
        { level: 'A step up', fig: () => FIG.chord({ oa: true, ticks: true, right: false, lens: [['OA', '17'], ['OM', '?']] }),
          q: 'The radius is $17$ cm, $M$ is the midpoint of chord $AB$ and $AB=30$ cm. Find $OM$.',
          rows: [['OM\\perp AB', 'line from centre to midpt of chord'], ['AM=15\\text{ cm}', 'given: M is the midpoint'], ['OM^2=17^2-15^2=64', 'Pythagoras'], ['OM=8\\text{ cm}', '']],
          answer: '$OM=8$ cm' },
        { level: 'Harder', fig: () => FIG.chord({ oa: true, ticks: true, right: false, ext: true, lens: [['OA', '10']] }),
          q: 'The radius is $10$ cm and $M$ is the midpoint of chord $AB=16$ cm. $OM$ is extended to meet the circle at $P$. Find $MP$.',
          rows: [['OM\\perp AB', 'line from centre to midpt of chord'], ['OM=\\sqrt{10^2-8^2}=6\\text{ cm}', 'Pythagoras'], ['OP=10\\text{ cm}', 'radii'], ['MP=10-6=4\\text{ cm}', '']],
          answer: '$MP=4$ cm', note: '$OP$ is another radius, so it is $10$ cm too.' },
      ],
      tip: 'Same picture, two theorems. Told “⊥”? It halves the chord. Told “midpoint”? It is ⊥. Pick the reason that starts from what you were told.',
      sources: SRC,
    }] },
  ];

  L['euc-cyclic'] = [
    { title: 'The angle at the centre', steps: [{
      title: 'The angle at the centre is double the angle at the circle',
      words: [
        ['circumference', 'the circle itself, the curved edge. An angle “at the circumference” has its corner on the circle.'],
        ['arc', 'a piece of the circle between two points.'],
        ['stands on (subtends)', 'an angle stands on arc $AB$ if its two arms go to $A$ and $B$.'],
        ['diameter', 'a chord through the centre. A semicircle is half the circle, cut off by a diameter.'],
        ['segment', 'the region between a chord and the circle. A chord cuts a circle into two segments.'],
      ],
      explain: `<p>Take two points $A$ and $B$ on a circle with centre $O$. The angle $A\\hat OB$ at the centre and an angle $A\\hat CB$ at the circle both stand on arc $AB$. The one at the centre is <b>twice</b> as big: $A\\hat OB=2\\,A\\hat CB$.</p>
<p>Two facts follow straight away:</p>
<ul><li>If $AB$ is a <b>diameter</b>, $A\\hat OB=180^\\circ$, so any angle on the circle standing on it is $90^\\circ$ (angle in a semicircle).</li>
<li>Every angle at the circle standing on the same arc, on the same side, equals half the same centre angle, so they are all <b>equal</b> (angles in the same segment).</li></ul>`,
      fig: () => FIG.centre(100, { c: 95, arcs: [['AOB', '2x', { r: 16 }], ['ACB', 'x', { r: 16 }]] }),
      figNote: 'Both angles stand on arc $AB$: the one at $O$ is $2x$, the one at $C$ is $x$.',
      reasons: [R.centre, R.semi, R.seg, R.radii, R.isos, R.sum],
      examples: [
        { level: 'Start here', fig: () => FIG.centre(110, { c: 95, arcs: [['AOB', '110°', { r: 16 }], ['ACB', '?', { r: 16 }]] }),
          q: '$O$ is the centre and $A\\hat OB=110^\\circ$. Find $A\\hat CB$.',
          rows: [['A\\hat CB=\\tfrac12\\times110^\\circ=55^\\circ', '∠ at centre = 2 × ∠ at circum']],
          answer: '$A\\hat CB=55^\\circ$' },
        { level: 'A step up', fig: () => FIG.centre(130, { ab: true, arcs: [['OAB', '25°', { r: 20 }], ['ACB', '?', { r: 16 }]] }),
          q: '$O$ is the centre and $O\\hat AB=25^\\circ$. Find $A\\hat CB$.',
          rows: [['OA=OB', 'radii'], ['O\\hat BA=25^\\circ', '∠s opp equal sides'], ['A\\hat OB=180^\\circ-50^\\circ=130^\\circ', 'sum of ∠s in △'], ['A\\hat CB=65^\\circ', '∠ at centre = 2 × ∠ at circum']],
          answer: '$A\\hat CB=65^\\circ$', note: 'Two radii make an isosceles triangle. Look for them in every circle question.' },
        { level: 'A diameter', fig: () => FIG.semi(32, { arcs: [['CAB', '32°', { r: 22 }], ['CBA', '?', { r: 22 }]] }),
          q: '$AB$ is a diameter and $C\\hat AB=32^\\circ$. Find $C\\hat BA$.',
          rows: [['A\\hat CB=90^\\circ', '∠ in semi-circle'], ['C\\hat BA=180^\\circ-90^\\circ-32^\\circ=58^\\circ', 'sum of ∠s in △']],
          answer: '$C\\hat BA=58^\\circ$' },
        { level: 'With algebra', fig: () => FIG.centre(110, { c: 95, arcs: [['AOB', '4x−10°', { r: 16 }], ['ACB', 'x+25°', { r: 16 }]] }),
          q: '$A\\hat OB=4x-10^\\circ$ and $A\\hat CB=x+25^\\circ$. Find $x$.',
          rows: [['4x-10=2(x+25)', '∠ at centre = 2 × ∠ at circum'], ['2x=60,\\ x=30', '']],
          answer: '$x=30$ (so $A\\hat CB=55^\\circ$ and $A\\hat OB=110^\\circ$)', note: 'Check: $110=2\\times55$.' },
      ],
      tip: 'Find the arc both angles stand on. At the centre: double. At the circle: half. Standing on a diameter: $90^\\circ$.',
      sources: SRC,
    }] },
    { title: 'Opposite angles of a cyclic quadrilateral', steps: [{
      title: 'Opposite angles of a cyclic quadrilateral add up to 180°',
      words: [
        ['cyclic quadrilateral', 'a four-sided shape with all four corners on one circle.'],
        ['supplementary', 'adding up to $180^\\circ$.'],
        ['exterior angle', 'the angle outside a shape between one side and the next side extended.'],
      ],
      explain: `<p>In a <b>cyclic quadrilateral</b> $ABCD$, opposite angles are <b>supplementary</b>: $\\hat A+\\hat C=180^\\circ$ and $\\hat B+\\hat D=180^\\circ$.</p>
<p><b>Why:</b> $\\hat A$ and $\\hat C$ stand on the two arcs $BD$ that make up the whole circle. Their centre angles add up to $360^\\circ$, so the angles themselves add up to half of that.</p>
<p>A consequence: if you extend side $DC$ to $E$, the <b>exterior angle</b> $B\\hat CE$ equals $\\hat A$, the interior angle opposite it.</p>
<p>Only use these once you know the quadrilateral is cyclic (it is given, or you proved it).</p>`,
      fig: () => FIG.cyclic(100, { ext: true, arcs: [['DAB', 'x'], ['BCD', '180°−x', { r: 20 }], ['BCE', 'x', { r: 16 }]] }),
      figNote: '$\\hat A=x$, so $\\hat C=180^\\circ-x$ and the exterior angle $B\\hat CE=x$.',
      reasons: [R.oppCyc, R.extCyc, R.centre],
      examples: [
        { level: 'Start here', fig: () => FIG.cyclic(95, { arcs: [['DAB', '95°'], ['BCD', '?']] }),
          q: '$ABCD$ is a cyclic quadrilateral and $\\hat A=95^\\circ$. Find $\\hat C$.',
          rows: [['\\hat C=180^\\circ-95^\\circ=85^\\circ', 'opp ∠s of cyclic quad']], answer: '$\\hat C=85^\\circ$' },
        { level: 'Outside angle', fig: () => FIG.cyclic(102, { ext: true, arcs: [['DAB', '102°'], ['BCE', '?']] }),
          q: '$ABCD$ is cyclic and $DC$ is extended to $E$. $\\hat A=102^\\circ$. Find $B\\hat CE$.',
          rows: [['B\\hat CE=\\hat A=102^\\circ', 'ext ∠ of cyclic quad']], answer: '$B\\hat CE=102^\\circ$',
          note: 'Long way round: $\\hat C=78^\\circ$ (opp ∠s of cyclic quad), then $B\\hat CE=180^\\circ-78^\\circ$ (∠s on a str line). Same answer.' },
        { level: 'With the centre', fig: () => FIG.cyclic(70, { centre: true, arcs: [['BOD', '140°', { r: 16 }], ['BCD', '?']] }),
          q: '$O$ is the centre, $ABCD$ is cyclic and $B\\hat OD=140^\\circ$. Find $B\\hat CD$.',
          rows: [['\\hat A=\\tfrac12\\times140^\\circ=70^\\circ', '∠ at centre = 2 × ∠ at circum'], ['B\\hat CD=180^\\circ-70^\\circ=110^\\circ', 'opp ∠s of cyclic quad']],
          answer: '$B\\hat CD=110^\\circ$', note: '$\\hat A$ is on the far side from the $140^\\circ$ angle, so it stands on the same arc $BD$.' },
      ],
      tip: 'Opposite corners are partners that make $180^\\circ$. An outside angle copies the inside angle across from it.',
      sources: SRC,
    }] },
  ];

  L['euc-tan-chord'] = [
    { title: 'A tangent is perpendicular to the radius', steps: [{
      title: 'A tangent meets the radius at 90°',
      words: [
        ['tangent', 'a straight line that touches a circle at exactly one point and does not cut into it.'],
        ['point of contact', 'the one point where a tangent touches the circle.'],
        ['outside point', 'a point outside the circle. From it you can draw two tangents.'],
      ],
      explain: `<p>A <b>tangent</b> touches a circle at one point $T$. The radius $OT$ to that point is always <b>perpendicular</b> to the tangent: $O\\hat TP=90^\\circ$. That right angle usually means Pythagoras or the angle sum is next.</p>
<p>From an outside point $P$ you can draw two tangents, touching at $A$ and $B$. They are <b>equal in length</b>: $PA=PB$. So $\\triangle PAB$ is isosceles.</p>`,
      fig: () => FIG.tangent(55),
      figNote: '$OT\\perp PT$: the square at $T$.',
      reasons: [R.tanRad, R.tans, R.pyth, R.sum, R.isos, R.quad],
      examples: [
        { level: 'Start here', fig: () => FIG.tangent(Math.atan(15 / 8) * 180 / Math.PI, { lens: [['OT', '8'], ['OP', '17'], ['TP', '?']] }),
          q: '$PT$ is a tangent at $T$. $OT=8$ cm and $OP=17$ cm. Find $PT$.',
          rows: [['O\\hat TP=90^\\circ', 'tan ⊥ radius'], ['PT^2=17^2-8^2=225', 'Pythagoras'], ['PT=15\\text{ cm}', '']], answer: '$PT=15$ cm' },
        { level: 'Angles', fig: () => FIG.tangent(54, { arcs: [['TOP', '54°', { r: 18 }], ['OPT', '?', { r: 30 }]] }),
          q: '$PT$ is a tangent at $T$ and $T\\hat OP=54^\\circ$. Find $O\\hat PT$.',
          rows: [['O\\hat TP=90^\\circ', 'tan ⊥ radius'], ['O\\hat PT=180^\\circ-90^\\circ-54^\\circ=36^\\circ', 'sum of ∠s in △']], answer: '$O\\hat PT=36^\\circ$' },
        { level: 'Two tangents', fig: () => FIG.twoTangents(70, { ab: true, arcs: [['APB', '70°', { r: 26 }], ['PAB', '?', { r: 18 }]] }),
          q: '$PA$ and $PB$ are tangents and $A\\hat PB=70^\\circ$. Find $P\\hat AB$.',
          rows: [['PA=PB', 'tans from common pt'], ['P\\hat AB=P\\hat BA', '∠s opp equal sides'], ['P\\hat AB=(180^\\circ-70^\\circ)\\div2=55^\\circ', 'sum of ∠s in △']], answer: '$P\\hat AB=55^\\circ$' },
        { level: 'Harder', fig: () => FIG.twoTangents(50, { radii: true, ticks: false, arcs: [['AOB', '130°', { r: 18 }], ['APB', '?', { r: 26 }]] }),
          q: '$PA$ and $PB$ are tangents and $A\\hat OB=130^\\circ$. Find $A\\hat PB$.',
          rows: [['O\\hat AP=O\\hat BP=90^\\circ', 'tan ⊥ radius'], ['A\\hat PB=360^\\circ-90^\\circ-90^\\circ-130^\\circ=50^\\circ', 'sum of ∠s in quad']], answer: '$A\\hat PB=50^\\circ$',
          note: '$OAPB$ is a quadrilateral with two right angles, so the other two angles add up to $180^\\circ$.' },
      ],
      tip: 'Where a radius meets a tangent, draw the little square: $90^\\circ$. Two tangents from one point are twins: the same length.',
      sources: SRC,
    }] },
    { title: 'The tan-chord theorem', steps: [{
      title: 'The angle between a tangent and a chord',
      words: [
        ['alternate segment', 'the segment on the other side of the chord from the angle you are looking at.'],
        ['tan-chord angle', 'the angle between a tangent and a chord drawn from the point of contact.'],
      ],
      explain: `<p>Draw a tangent $QS$ touching at $T$, and a chord $TA$ from the point of contact. The angle between them, $S\\hat TA$, equals any angle at the circle standing on $TA$ in the <b>alternate segment</b>, such as $T\\hat BA$.</p>
<p>To find the right angle: stand on the chord $TA$, look across it, away from the angle at $T$, and find the angle whose arms go to $T$ and $A$.</p>`,
      fig: () => FIG.tanChord(50, 70, { arcs: [['STA', 'x', { r: 26 }], ['TBA', 'x', { r: 18 }]] }),
      figNote: 'The angle between tangent $TS$ and chord $TA$ equals $T\\hat BA$ on the other side of $TA$.',
      reasons: [R.tanChord, R.sum, R.tanRad],
      examples: [
        { level: 'Start here', fig: () => FIG.tanChord(48, 70, { arcs: [['STA', '48°', { r: 26 }], ['TBA', '?', { r: 18 }]] }),
          q: '$QS$ is a tangent at $T$ and $S\\hat TA=48^\\circ$. Find $T\\hat BA$.',
          rows: [['T\\hat BA=S\\hat TA=48^\\circ', 'tan chord theorem']], answer: '$T\\hat BA=48^\\circ$' },
        { level: 'A step up', fig: () => FIG.tanChord(55, 62, { arcs: [['STA', '55°', { r: 26 }], ['ATB', '62°', { r: 20 }], ['TAB', '?', { r: 18 }]] }),
          q: '$QS$ is a tangent at $T$, $S\\hat TA=55^\\circ$ and $A\\hat TB=62^\\circ$. Find $T\\hat AB$.',
          rows: [['T\\hat BA=55^\\circ', 'tan chord theorem'], ['T\\hat AB=180^\\circ-62^\\circ-55^\\circ=63^\\circ', 'sum of ∠s in △']], answer: '$T\\hat AB=63^\\circ$' },
        { level: 'The other side', fig: () => FIG.tanChord(50, 72, { arcs: [['TAB', '58°', { r: 18 }], ['QTB', '?', { r: 26 }]] }),
          q: '$QS$ is a tangent at $T$ and $T\\hat AB=58^\\circ$. Find $Q\\hat TB$.',
          rows: [['Q\\hat TB=T\\hat AB=58^\\circ', 'tan chord theorem']], answer: '$Q\\hat TB=58^\\circ$',
          note: 'This time the chord is $TB$, so the angle across it is at $A$.' },
      ],
      tip: 'Tangent and chord meet at the point of contact. Slide across the chord: the angle in the other segment is the same.',
      sources: SRC,
    }] },
  ];

  L['euc-similar'] = [
    { title: 'AAA similarity', steps: [{
      title: 'Triangles with equal angles are similar',
      words: [
        ['similar (|||)', 'the same shape but not necessarily the same size: one is an enlargement of the other.'],
        ['equiangular', 'having all angles equal: each angle of one triangle equals an angle of the other.'],
        ['corresponding', 'in the matching position. In $\\triangle ABC\\,|||\\,\\triangle DEF$, $A$ matches $D$, $B$ matches $E$, $C$ matches $F$.'],
      ],
      explain: `<p>If two triangles are <b>equiangular</b>, they are <b>similar</b>: written $\\triangle ABC\\,|||\\,\\triangle DEF$, reason (∠∠∠).</p>
<p>You only need two pairs of equal angles: the third pair is then equal too, because each triangle’s angles add up to $180^\\circ$.</p>
<p>Write the letters in matching order, so equal angles line up. Congruent ($\\equiv$) means same shape <i>and</i> size; similar means same shape.</p>`,
      fig: () => FIG.simPair(60, 50, 1.5),
      figNote: 'One arc matches one arc and two arcs match two arcs, so $\\triangle ABC\\,|||\\,\\triangle DEF$.',
      reasons: [R.aaa, R.simS, R.sum, R.corr, R.common],
      examples: [
        { level: 'Start here', fig: () => FIG.simPair(60, 50, 1.5),
          q: '$\\hat A=\\hat D$ and $\\hat C=\\hat F$. Show that the triangles are similar and name them correctly.',
          rows: [['\\hat A=\\hat D', 'given'], ['\\hat C=\\hat F', 'given'], ['\\hat B=\\hat E', 'sum of ∠s in △'], ['\\triangle ABC\\,|||\\,\\triangle DEF', '∠∠∠']],
          answer: '$\\triangle ABC\\,|||\\,\\triangle DEF$' },
        { level: 'A step up', fig: () => FIG.simNested(60, 55, 0.45),
          q: '$D$ is on $AB$ and $E$ is on $AC$ with $DE\\parallel BC$. Prove that $\\triangle ADE\\,|||\\,\\triangle ABC$.',
          rows: [['A\\hat DE=A\\hat BC', 'corresp ∠s; DE ∥ BC'], ['A\\hat ED=A\\hat CB', 'corresp ∠s; DE ∥ BC'], ['\\hat A=\\hat A', 'common'], ['\\triangle ADE\\,|||\\,\\triangle ABC', '∠∠∠']],
          answer: '$\\triangle ADE\\,|||\\,\\triangle ABC$', note: 'A line parallel to one side always cuts off a smaller similar triangle.' },
        { level: 'Using it', fig: () => FIG.simPair(65, 51, 1.5, { l1: '64°', l4: '51°', arcs: [['DEF', '?', { r: 20 }]] }),
          q: '$\\triangle ABC\\,|||\\,\\triangle DEF$, $\\hat A=64^\\circ$ and $\\hat F=51^\\circ$. Find $\\hat E$.',
          rows: [['\\hat D=\\hat A=64^\\circ', '|||△s'], ['\\hat E=180^\\circ-64^\\circ-51^\\circ=65^\\circ', 'sum of ∠s in △']], answer: '$\\hat E=65^\\circ$' },
      ],
      tip: 'Equal angles, matching order. Write the names so equal angles line up: first with first, second with second, third with third.',
      sources: [SIYAVULA, PAUL],
    }] },
    { title: 'Corresponding sides of similar triangles', steps: [{
      title: 'Matching sides are in the same ratio',
      words: [
        ['ratio', 'a comparison by division, such as $\\frac{6}{4}$.'],
        ['proportional', 'in the same ratio: every pair of matching sides gives the same fraction.'],
        ['scale factor', 'the number you multiply by to go from one similar triangle to the other.'],
      ],
      explain: `<p>In similar triangles, matching sides are <b>proportional</b>. If $\\triangle ABC\\,|||\\,\\triangle DEF$, then
$$\\frac{DE}{AB}=\\frac{EF}{BC}=\\frac{DF}{AC}.$$</p>
<p>Recipe: prove (or quote) the similarity first, write the ratio with the unknown on top, put in the numbers and solve.</p>`,
      fig: () => FIG.simPair(60, 50, 1.5, { lens: [['AB', '4'], ['DE', '6']] }),
      figNote: 'The scale factor here is $\\frac{6}{4}=1.5$: every side of $\\triangle DEF$ is $1.5$ times its partner.',
      reasons: [R.simS, R.aaa, R.corr],
      examples: [
        { level: 'Start here', fig: () => FIG.simPair(60, 50, 1.5, { lens: [['AB', '4'], ['BC', '6'], ['DE', '6'], ['EF', '?']] }),
          q: '$\\triangle ABC\\,|||\\,\\triangle DEF$ with $AB=4$, $BC=6$ and $DE=6$ (cm). Find $EF$.',
          rows: [['\\dfrac{EF}{BC}=\\dfrac{DE}{AB}', '|||△s'], ['EF=6\\times\\dfrac{6}{4}=9\\text{ cm}', '']], answer: '$EF=9$ cm' },
        { level: 'A step up', fig: () => FIG.simNested(60, 55, 1 / 3, { lens: [['AD', '3'], ['DB', '6'], ['DE', '4'], ['BC', '?']] }),
          q: '$DE\\parallel BC$, $AD=3$, $DB=6$ and $DE=4$ (cm). Find $BC$.',
          rows: [['\\triangle ADE\\,|||\\,\\triangle ABC', '∠∠∠'], ['\\dfrac{BC}{DE}=\\dfrac{AB}{AD}=\\dfrac{9}{3}', '|||△s'], ['BC=4\\times3=12\\text{ cm}', '']], answer: '$BC=12$ cm',
          note: 'Use the whole side $AB=3+6=9$, not $DB$: the big triangle is $ABC$.' },
        { level: 'With algebra', fig: () => FIG.simNested(60, 55, 0.6, { lens: [['AD', 'x'], ['DB', '4'], ['DE', '6'], ['BC', '10']] }),
          q: '$DE\\parallel BC$, $AD=x$, $DB=4$, $DE=6$ and $BC=10$ (cm). Find $x$.',
          rows: [['\\triangle ADE\\,|||\\,\\triangle ABC', '∠∠∠'], ['\\dfrac{x}{x+4}=\\dfrac{6}{10}', '|||△s'], ['10x=6x+24,\\ x=6', '']], answer: '$x=6$' },
        { level: 'Real life', fig: () => FIG.shadow(2, 3, 12, 18),
          q: 'A $2$ m pole casts a $3$ m shadow. At the same time a tree casts an $18$ m shadow. How tall is the tree?',
          rows: [['\\triangle ABC\\,|||\\,\\triangle DEF', '∠∠∠'], ['\\dfrac{DE}{AB}=\\dfrac{EF}{BC}', '|||△s'], ['DE=2\\times\\dfrac{18}{3}=12\\text{ m}', '']], answer: '$12$ m',
          note: 'Both have a right angle and the same angle of the sun, so the triangles are equiangular.' },
      ],
      tip: 'Same letters, same position. Big over small for every pair, and every pair gives the same fraction.',
      sources: [SIYAVULA, PAUL],
    }] },
  ];

  L['euc-circle-riders'] = [
    { title: 'A rider step with the angle at the centre', steps: [{
      title: 'Riders: chaining facts in a new diagram',
      words: [
        ['rider', 'an exam question that gives a new diagram and asks you to find or prove something using the theorems.'],
        ['bookwork (theorem proof)', 'proving one of the theorems themselves, as in the textbook. A rider uses the theorems; bookwork proves them.'],
        ['chain', 'a list of statements, each with a reason, that leads from what is given to what is asked.'],
      ],
      explain: `<p>Most marks in Paper 2 geometry are for <b>riders</b>. A rider never needs a new theorem, only a short chain of the ones you know.</p>
<p>How to attack one:</p>
<ol><li>Mark everything given on the diagram.</li>
<li>Hunt for the usual suspects: two <b>radii</b> (isosceles triangle), a <b>diameter</b> ($90^\\circ$), a <b>tangent</b> ($90^\\circ$ to the radius, tan-chord), four points on the circle (cyclic quad).</li>
<li>Work towards what is asked, one line at a time. Every line gets a reason. Start each line with words or the thing you found, and end with the answer to the question.</li></ol>`,
      fig: () => FIG.centre(124, { ab: true, arcs: [['OAB', '28°', { r: 20 }], ['ACB', '?', { r: 16 }]] }),
      figNote: 'Two radii, $OA$ and $OB$, make $\\triangle OAB$ isosceles: that is the way in.',
      reasons: [R.radii, R.isos, R.sum, R.centre, R.semi, R.seg],
      examples: [
        { level: 'Start here', fig: () => FIG.centre(124, { ab: true, arcs: [['OAB', '28°', { r: 20 }], ['ACB', '?', { r: 16 }]] }),
          q: '$O$ is the centre and $O\\hat AB=28^\\circ$. Find $A\\hat CB$.',
          rows: [['OA=OB', 'radii'], ['O\\hat BA=28^\\circ', '∠s opp equal sides'], ['A\\hat OB=180^\\circ-56^\\circ=124^\\circ', 'sum of ∠s in △'], ['A\\hat CB=62^\\circ', '∠ at centre = 2 × ∠ at circum']],
          answer: '$A\\hat CB=62^\\circ$' },
        { level: 'Backwards', fig: () => FIG.centre(80, { c: 125, d: 55, ab: true, arcs: [['ADB', '40°', { r: 16 }], ['OBA', '?', { r: 20 }]] }),
          q: '$O$ is the centre, $C$ and $D$ are on the major arc and $A\\hat DB=40^\\circ$. Find $O\\hat BA$.',
          rows: [['A\\hat OB=2\\times40^\\circ=80^\\circ', '∠ at centre = 2 × ∠ at circum'], ['OA=OB', 'radii'], ['O\\hat BA=(180^\\circ-80^\\circ)\\div2=50^\\circ', '∠s opp equal sides; sum of ∠s in △']],
          answer: '$O\\hat BA=50^\\circ$' },
        { level: 'Three theorems', fig: () => FIG.semi(35, { d: 270, arcs: [['CAB', '35°', { r: 22 }], ['ADC', '?', { r: 18 }]] }),
          q: '$AB$ is a diameter, $C$ and $D$ are on opposite sides of $AB$, and $C\\hat AB=35^\\circ$. Find $A\\hat DC$.',
          rows: [['A\\hat CB=90^\\circ', '∠ in semi-circle'], ['A\\hat BC=180^\\circ-90^\\circ-35^\\circ=55^\\circ', 'sum of ∠s in △'], ['A\\hat DC=A\\hat BC=55^\\circ', '∠s in the same seg']],
          answer: '$A\\hat DC=55^\\circ$', note: '$A\\hat DC$ and $A\\hat BC$ both stand on chord $AC$, on the same side of it.' },
      ],
      tip: 'Hunt first, write second: radii → isosceles, diameter → $90^\\circ$, tangent → $90^\\circ$ and tan-chord, four points on a circle → cyclic quad.',
      sources: [SIYAVULA, BOP, PAUL],
    }] },
    { title: 'A cyclic-quadrilateral rider', steps: [{
      title: 'Riders with cyclic quadrilaterals',
      words: [
        ['cyclic quadrilateral', 'a four-sided shape with all four corners on one circle.'],
        ['converse', 'a theorem turned around. Here: if opposite angles add up to $180^\\circ$, the quadrilateral is cyclic.'],
      ],
      explain: `<p>Two different jobs come up:</p>
<ul><li><b>Using</b> a cyclic quadrilateral: you already know it is cyclic, so opposite angles add up to $180^\\circ$ and an exterior angle equals the interior opposite angle.</li>
<li><b>Proving</b> a quadrilateral is cyclic: show that a pair of opposite angles adds up to $180^\\circ$ and quote the converse (opp ∠s of quad suppl).</li></ul>
<p>Watch for equal chords too: equal sides in a triangle mean equal angles.</p>`,
      fig: () => FIG.cyclic(100, { bc: 100, diag: ['BD'], ticks: [['BC', 1], ['CD', 1]] }),
      figNote: '$BC=CD$ (one tick each), so $\\triangle BCD$ is isosceles.',
      reasons: [R.oppCyc, R.extCyc, R.convCyc, R.isos, R.sum],
      examples: [
        { level: 'Start here', fig: () => FIG.cyclic(100, { bc: 100, diag: ['BD'], ticks: [['BC', 1], ['CD', 1]], arcs: [['DAB', '100°'], ['CBD', '?', { r: 22 }]] }),
          q: '$ABCD$ is cyclic, $BC=CD$ and $\\hat A=100^\\circ$. Find $C\\hat BD$.',
          rows: [['B\\hat CD=180^\\circ-100^\\circ=80^\\circ', 'opp ∠s of cyclic quad'], ['C\\hat BD=C\\hat DB', '∠s opp equal sides'], ['C\\hat BD=(180^\\circ-80^\\circ)\\div2=50^\\circ', 'sum of ∠s in △']],
          answer: '$C\\hat BD=50^\\circ$' },
        { level: 'A step up', fig: () => FIG.cyclic(75, { bc: 80, diag: ['AC'], arcs: [['BAC', '40°', { r: 26 }], ['CAD', '35°', { r: 34 }], ['BCD', '?']] }),
          q: '$ABCD$ is cyclic, $B\\hat AC=40^\\circ$ and $C\\hat AD=35^\\circ$. Find $B\\hat CD$.',
          rows: [['B\\hat AD=40^\\circ+35^\\circ=75^\\circ', ''], ['B\\hat CD=180^\\circ-75^\\circ=105^\\circ', 'opp ∠s of cyclic quad']], answer: '$B\\hat CD=105^\\circ$' },
        { level: 'Proving it is cyclic', fig: () => FIG.cyclic(112, { noCircle: true, arcs: [['DAB', '112°'], ['BCD', '68°']] }),
          q: 'In quadrilateral $ABCD$, $\\hat A=112^\\circ$ and $\\hat C=68^\\circ$. Prove that $ABCD$ is cyclic.',
          rows: [['\\hat A+\\hat C=112^\\circ+68^\\circ=180^\\circ', ''], ['ABCD\\text{ is cyclic}', 'opp ∠s of quad suppl']], answer: '$ABCD$ is a cyclic quadrilateral',
          note: 'You may not use “opp ∠s of cyclic quad” here: that assumes what you are proving.' },
        { level: 'Outside angle', fig: () => FIG.cyclic(90, { ab: 90, bc: 58, extB: true, arcs: [['CBE', '74°', { r: 20 }], ['ADC', '?']] }),
          q: '$ABCD$ is cyclic and $AB$ is extended to $E$. $C\\hat BE=74^\\circ$. Find $A\\hat DC$.',
          rows: [['A\\hat DC=C\\hat BE=74^\\circ', 'ext ∠ of cyclic quad']], answer: '$A\\hat DC=74^\\circ$' },
      ],
      tip: 'Using a cyclic quad? You must already know it is cyclic. Proving one? Show opposite angles add up to $180^\\circ$ and quote the converse.',
      sources: SRC,
    }] },
  ];

  L['euc-mixed'] = [
    { title: 'Tan-chord with the angle at the centre', steps: [{
      title: 'Tangents meet the centre',
      words: [
        ['tangent', 'a line touching the circle at one point, the point of contact.'],
        ['alternate segment', 'the segment on the other side of the chord from the tangent angle.'],
        ['angle at the centre', 'an angle with its corner at the centre $O$; it is double the angle at the circle on the same arc.'],
      ],
      explain: `<p>Questions in this part link a tangent to the centre. You have two ways in from a tangent:</p>
<ul><li>the radius to the point of contact is at $90^\\circ$ to the tangent (tan ⊥ radius);</li>
<li>the tangent–chord angle equals the angle in the alternate segment (tan chord theorem), and that angle is half the angle at the centre.</li></ul>
<p>Pick the one that reaches the angle you want in the fewest lines.</p>`,
      fig: () => FIG.tanChord(40, 80, { centre: true, arcs: [['STA', 'x', { r: 26 }], ['TBA', 'x', { r: 18 }], ['TOA', '2x', { r: 16 }]] }),
      figNote: 'Tangent angle $x$, angle in the alternate segment $x$, angle at the centre $2x$.',
      reasons: [R.tanChord, R.centre, R.tanRad, R.radii, R.isos],
      examples: [
        { level: 'Start here', fig: () => FIG.tanChord(40, 80, { centre: true, arcs: [['STA', '40°', { r: 26 }], ['TOA', '?', { r: 16 }]] }),
          q: '$QS$ is a tangent at $T$ and $S\\hat TA=40^\\circ$. Find $T\\hat OA$.',
          rows: [['T\\hat BA=40^\\circ', 'tan chord theorem'], ['T\\hat OA=2\\times40^\\circ=80^\\circ', '∠ at centre = 2 × ∠ at circum']], answer: '$T\\hat OA=80^\\circ$' },
        { level: 'Using the radius', fig: () => FIG.tanChord(50, 70, { centre: true, arcs: [['STA', '50°', { r: 26 }], ['OAT', '?', { r: 18 }]] }),
          q: '$QS$ is a tangent at $T$ and $S\\hat TA=50^\\circ$. Find $O\\hat AT$.',
          rows: [['O\\hat TS=90^\\circ', 'tan ⊥ radius'], ['O\\hat TA=90^\\circ-50^\\circ=40^\\circ', ''], ['OT=OA', 'radii'], ['O\\hat AT=40^\\circ', '∠s opp equal sides']], answer: '$O\\hat AT=40^\\circ$' },
        { level: 'Backwards', fig: () => FIG.tanChord(62, 50, { centre: true, arcs: [['TOA', '124°', { r: 16 }], ['STA', '?', { r: 26 }]] }),
          q: '$QS$ is a tangent at $T$ and $T\\hat OA=124^\\circ$. Find $S\\hat TA$.',
          rows: [['T\\hat BA=\\tfrac12\\times124^\\circ=62^\\circ', '∠ at centre = 2 × ∠ at circum'], ['S\\hat TA=62^\\circ', 'tan chord theorem']], answer: '$S\\hat TA=62^\\circ$' },
      ],
      tip: 'A tangent hands you two tools: $90^\\circ$ to the radius, and the tan-chord angle. Use whichever reaches the centre faster.',
      sources: SRC,
    }] },
    { title: 'Midpoint theorem in a mixed rider', steps: [{
      title: 'Midpoints inside a circle',
      words: [
        ['midpoint theorem', 'joining the midpoints of two sides of a triangle gives a line parallel to the third side and half as long.'],
        ['diameter', 'a chord through the centre; it is two radii long.'],
      ],
      explain: `<p>Circle questions often hide a triangle with two midpoints. Two different facts can apply, so read which midpoints you have:</p>
<ul><li>midpoints of <b>two sides of a triangle</b> → joining line is parallel to the third side and half as long (midpt theorem);</li>
<li>midpoint of <b>a chord</b>, joined to the centre → perpendicular to the chord (line from centre to midpt of chord).</li></ul>`,
      fig: () => FIG.midChords({ diameter: true, a: 100, arrows: true }),
      figNote: '$M$ and $N$ are midpoints (ticks), so $MN\\parallel BC$ (arrows) and $MN=\\frac12 BC$.',
      reasons: [R.mid, R.corr, R.semi, R.sum, R.midChord, R.quad],
      examples: [
        { level: 'Start here', fig: () => FIG.midChords({ diameter: true, a: 100 }),
          q: '$BC$ is a diameter of a circle with radius $7$ cm. $M$ and $N$ are the midpoints of $AB$ and $AC$. Find $MN$.',
          rows: [['BC=2\\times7=14\\text{ cm}', ''], ['MN=\\tfrac12\\times14=7\\text{ cm}', 'midpt theorem']], answer: '$MN=7$ cm' },
        { level: 'A step up', fig: () => FIG.midChords({ diameter: true, a: 68, arcs: [['ABC', '34°', { r: 22 }], ['ANM', '?', { r: 16 }]] }),
          q: '$BC$ is a diameter, $M$ and $N$ are the midpoints of $AB$ and $AC$, and $A\\hat BC=34^\\circ$. Find $A\\hat NM$.',
          rows: [['B\\hat AC=90^\\circ', '∠ in semi-circle'], ['A\\hat CB=180^\\circ-90^\\circ-34^\\circ=56^\\circ', 'sum of ∠s in △'], ['MN\\parallel BC', 'midpt theorem'], ['A\\hat NM=56^\\circ', 'corresp ∠s; MN ∥ BC']],
          answer: '$A\\hat NM=56^\\circ$' },
        { level: 'Both kinds', fig: () => FIG.midChords({ centre: true, b: 206, c: 334, a: 90, arcs: [['BAC', '64°', { r: 18 }], ['MON', '?', { r: 16 }]] }),
          q: '$O$ is the centre, $M$ and $N$ are the midpoints of chords $AB$ and $AC$, and $B\\hat AC=64^\\circ$. Find $M\\hat ON$.',
          rows: [['O\\hat MA=O\\hat NA=90^\\circ', 'line from centre to midpt of chord'], ['M\\hat ON=360^\\circ-90^\\circ-90^\\circ-64^\\circ=116^\\circ', 'sum of ∠s in quad']], answer: '$M\\hat ON=116^\\circ$' },
      ],
      tip: 'Two midpoints of a triangle: “parallel and half”. One midpoint of a chord with the centre: “perpendicular”.',
      sources: SRC,
    }] },
  ];

  const KpLessonsGr12 = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = KpLessonsGr12;
  root.KpLessonsGr12 = KpLessonsGr12;
})(typeof globalThis !== 'undefined' ? globalThis : this);
