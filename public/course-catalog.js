/* Togisumasu course library: the shelves on the Courses page.
 *
 * One shelf per level. Books with `live: true` are real courses in the database
 * (their table of contents comes from GET /api/courses?toc=1). Every other book is
 * a "Coming soon" placeholder with a planned table of contents (top-level topics only).
 *
 * The university shelves are a consolidated, de-duplicated reading of the undergraduate
 * Mathematics, Mathematics & Statistics, Statistics and Physics programmes at:
 *   OX   University of Oxford (Mathematics / Maths & Statistics, Physics; course pages, 2026 entry)
 *   MIT  Massachusetts Institute of Technology (Course 18 Mathematics, Course 8 Physics degree charts)
 *   SU   Stanford University (Math major, Physics major; Stanford Bulletin)
 *   HV   Harvard University (Mathematics concentration, related Statistics and Physics courses)
 *   UNISA University of South Africa (BSc Mathematics & Applied Mathematics 98801-MAM, Statistics modules)
 *   WITS University of the Witwatersrand (BSc Mathematical Sciences, Physics; Schools of Mathematics and Physics)
 * Where universities teach a subject in different years, the book sits in the year most
 * of them (and the South African universities in particular) teach it.
 *
 * subject drives the spine colour: 'maths' | 'stats' | 'physics' | 'science'.
 */
(function (root) {
  'use strict';
  const SOURCES = {
    OX: { name: 'University of Oxford', url: 'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/mathematics' },
    MIT: { name: 'MIT', url: 'https://catalog.mit.edu/degree-charts/mathematics-course-18/' },
    SU: { name: 'Stanford University', url: 'https://mathematics.stanford.edu/academics/undergraduate-students/math-major' },
    HV: { name: 'Harvard University', url: 'https://www.math.harvard.edu/undergraduate/courses-and-concentration-information/' },
    UNISA: { name: 'UNISA', url: 'https://www.unisa.ac.za/sites/corporate/default/Register-to-study-through-Unisa/Subjects-&-modules/All-subjects/MATHEMATICS' },
    WITS: { name: 'Wits University', url: 'https://www.wits.ac.za/course-finder/undergraduate/science/mathematical-sciences/' },
    CAPS: { name: 'DBE CAPS / NSC', url: 'https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS).aspx' },
  };

  const SUBJECTS = {
    maths: 'Mathematics',
    stats: 'Statistics',
    physics: 'Physics',
    science: 'Science',
  };

  const b = (id, title, subject, toc, sources, extra) => ({ id, title, subject, toc, sources, live: false, ...(extra || {}) });

  const SHELVES = [
    {
      id: 'school', name: 'High School', sub: 'Foundations · NSC Grades 10–12 (CAPS)',
      books: [
        { id: 'gr12-caps', title: 'Grade 12 Mathematics', short: 'CAPS', subject: 'maths', live: true, sources: ['CAPS'],
          blurb: 'NSC Paper 1 and Paper 2, aimed at a distinction. Unit 0 (Grade 10–11 foundations) is part of the course.' },
        { id: 'algebra', title: 'Algebra & Trigonometry', short: 'Bridge', subject: 'maths', live: true, sources: [],
          blurb: 'The original Togisumasu course: algebra and trigonometry from first principles.' },
        b('caps-physical-sciences', 'Grade 12 Physical Sciences', 'physics',
          ['Mechanics: Newton’s laws and momentum', 'Vertical projectile motion', 'Work, energy and power', 'Doppler effect',
           'Electrostatics and electric circuits', 'Electrodynamics', 'Optical phenomena (photoelectric effect)',
           'Chemical change: rates, equilibrium, acids and bases', 'Organic chemistry', 'Electrochemistry'],
          ['CAPS'], { short: 'CAPS', blurb: 'Paper 1 (physics) and Paper 2 (chemistry), 2014 onward.' }),
        b('caps-life-sciences', 'Grade 12 Life Sciences', 'science',
          ['DNA: the code of life', 'Meiosis', 'Reproduction in vertebrates', 'Human reproduction',
           'Genetics and inheritance', 'Responding to the environment (humans and plants)', 'Endocrine system and homeostasis',
           'Evolution'], ['CAPS'], { short: 'CAPS', blurb: 'Paper 1 and Paper 2, 2014 onward.' }),
      ],
    },
    {
      id: 'y1', name: 'University · First Year', sub: 'The common core every maths, stats and physics student meets',
      books: [
        b('calculus-1', 'Calculus I', 'maths',
          ['Limits and continuity', 'Differentiation and its rules', 'Applications of derivatives', 'Inverse, exponential, log and hyperbolic functions',
           'Integration and the fundamental theorem', 'Techniques of integration', 'Improper integrals', 'Sequences and series', 'First-order differential equations'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('linear-algebra-1', 'Linear Algebra I', 'maths',
          ['Vectors in R² and R³', 'Systems of linear equations', 'Matrices and matrix algebra', 'Determinants and Cramer’s rule',
           'Vector spaces and subspaces', 'Basis, dimension and rank', 'Linear transformations', 'Eigenvalues and eigenvectors', 'Complex numbers'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('proof', 'Proof & Mathematical Reasoning', 'maths',
          ['Logic and quantifiers', 'Direct proof, contradiction and contrapositive', 'Mathematical induction', 'Sets, relations and functions',
           'Countability', 'Inequalities and absolute value', 'The binomial theorem and sigma notation', 'Polar coordinates and conic sections'],
          ['OX', 'HV', 'SU', 'WITS']),
        b('multivariable-calculus', 'Multivariable & Vector Calculus', 'maths',
          ['Functions of several variables', 'Partial derivatives and the chain rule', 'Gradient and directional derivatives', 'Optimisation and Lagrange multipliers',
           'Double and triple integrals', 'Change of variables', 'Line and surface integrals', 'Green’s, Stokes’ and divergence theorems'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('probability-statistics-1', 'Probability & Statistics I', 'stats',
          ['Describing data', 'Probability and counting', 'Conditional probability and Bayes’ theorem', 'Discrete random variables',
           'Continuous random variables', 'Sampling distributions', 'Estimation and confidence intervals', 'Hypothesis testing', 'Simple linear regression'],
          ['OX', 'MIT', 'UNISA', 'WITS']),
        b('modelling-computing', 'Mathematical Modelling & Computing', 'maths',
          ['Building and testing models', 'Dimensional analysis', 'Programming for mathematics', 'Numerical solution of equations',
           'Difference equations', 'Simulation', 'Visualising data and functions'],
          ['OX', 'UNISA', 'WITS']),
        b('mechanics-1', 'Mechanics I', 'physics',
          ['Kinematics in one and two dimensions', 'Newton’s laws', 'Work and energy', 'Momentum and collisions',
           'Rotational motion and angular momentum', 'Gravitation and orbits', 'Oscillations', 'Special relativity'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('electromagnetism-1', 'Electricity & Magnetism I', 'physics',
          ['Electric charge and Coulomb’s law', 'Electric fields and Gauss’s law', 'Electric potential and capacitance', 'Current and DC circuits',
           'Magnetic fields and forces', 'Electromagnetic induction', 'AC circuits', 'Light and geometric optics'],
          ['OX', 'MIT', 'SU', 'HV', 'WITS']),
      ],
    },
    {
      id: 'y2', name: 'University · Second Year', sub: 'Rigour arrives: analysis, abstract algebra and modern physics',
      books: [
        b('real-analysis-1', 'Real Analysis I', 'maths',
          ['The real numbers and completeness', 'Sequences and convergence', 'Series and tests for convergence', 'Continuity',
           'Differentiability and the mean value theorem', 'The Riemann integral', 'Sequences and series of functions'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('linear-algebra-2', 'Linear Algebra II', 'maths',
          ['Abstract vector spaces', 'Linear maps and matrices', 'Inner product spaces', 'Orthogonality and Gram–Schmidt',
           'Diagonalisation', 'Cayley–Hamilton theorem', 'Symmetric matrices and quadratic forms', 'Jordan canonical form'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('abstract-algebra-1', 'Abstract Algebra I: Groups', 'maths',
          ['Binary operations and groups', 'Subgroups and cyclic groups', 'Permutation groups', 'Cosets and Lagrange’s theorem',
           'Normal subgroups and quotient groups', 'Homomorphisms and isomorphism theorems', 'Group actions'],
          ['OX', 'MIT', 'SU', 'HV', 'WITS']),
        b('differential-equations', 'Differential Equations', 'maths',
          ['First-order equations', 'Linear second-order equations', 'Systems of linear ODEs', 'Laplace transforms',
           'Series solutions', 'Phase plane and stability', 'Introduction to Fourier series'],
          ['OX', 'MIT', 'SU', 'UNISA', 'WITS']),
        b('discrete-mathematics', 'Discrete Mathematics', 'maths',
          ['Counting principles', 'Recurrence relations', 'Generating functions', 'Graphs and trees',
           'Graph algorithms', 'Boolean algebra', 'Elementary number theory'],
          ['OX', 'MIT', 'HV', 'UNISA']),
        b('numerical-methods', 'Numerical Methods', 'maths',
          ['Floating-point error', 'Root finding', 'Interpolation', 'Numerical differentiation and integration',
           'Solving linear systems', 'Numerical ODEs', 'Least squares approximation'],
          ['OX', 'MIT', 'UNISA', 'WITS']),
        b('probability-distribution-theory', 'Probability & Distribution Theory', 'stats',
          ['Axioms of probability', 'Joint and marginal distributions', 'Expectation, variance and covariance', 'Moment generating functions',
           'Transformations of random variables', 'Law of large numbers', 'Central limit theorem', 'Chi-square, t and F distributions'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('statistical-inference', 'Statistical Inference', 'stats',
          ['Point estimation and bias', 'Maximum likelihood', 'Confidence intervals', 'Hypothesis tests and power',
           'Goodness of fit and contingency tables', 'Nonparametric tests', 'Introduction to Bayesian inference'],
          ['OX', 'MIT', 'UNISA', 'WITS']),
        b('classical-mechanics-2', 'Classical Mechanics II', 'physics',
          ['Newtonian mechanics revisited', 'Central forces and orbits', 'Non-inertial frames', 'Rigid body motion',
           'Lagrangian mechanics', 'Hamiltonian mechanics', 'Small oscillations'],
          ['OX', 'MIT', 'SU', 'UNISA']),
        b('waves-optics', 'Waves & Optics', 'physics',
          ['Simple harmonic motion', 'Coupled oscillators and normal modes', 'Travelling and standing waves', 'Fourier analysis of waves',
           'Interference', 'Diffraction', 'Polarisation'],
          ['OX', 'MIT', 'WITS']),
        b('quantum-physics-1', 'Quantum Physics I', 'physics',
          ['Origins of quantum theory', 'Wave–particle duality', 'The Schrödinger equation', 'Particle in a box and potential wells',
           'Tunnelling', 'The harmonic oscillator', 'Operators and measurement', 'The hydrogen atom'],
          ['OX', 'MIT', 'SU', 'HV', 'WITS']),
        b('electromagnetism-2', 'Electromagnetism II', 'physics',
          ['Vector calculus for fields', 'Electrostatics and boundary problems', 'Magnetostatics', 'Fields in matter',
           'Maxwell’s equations', 'Electromagnetic waves', 'Radiation'],
          ['OX', 'MIT', 'SU', 'WITS']),
      ],
    },
    {
      id: 'y3', name: 'University · Third Year', sub: 'Majors: the core of a mathematics, statistics or physics degree',
      books: [
        b('complex-analysis', 'Complex Analysis', 'maths',
          ['Complex functions and mappings', 'Analytic functions and Cauchy–Riemann', 'Contour integration', 'Cauchy’s theorem and formula',
           'Taylor and Laurent series', 'Residue theorem', 'Conformal maps'],
          ['OX', 'MIT', 'SU', 'HV', 'WITS']),
        b('metric-spaces-topology', 'Metric Spaces & Topology', 'maths',
          ['Metric spaces', 'Open and closed sets', 'Continuity and convergence', 'Completeness and the contraction mapping theorem',
           'Compactness', 'Connectedness', 'Topological spaces'],
          ['OX', 'MIT', 'SU', 'HV', 'UNISA', 'WITS']),
        b('abstract-algebra-2', 'Abstract Algebra II: Rings & Fields', 'maths',
          ['Rings and ideals', 'Integral domains and fields', 'Polynomial rings', 'Unique factorisation',
           'Field extensions', 'Finite fields', 'Introduction to Galois theory'],
          ['OX', 'MIT', 'SU', 'HV', 'WITS']),
        b('number-theory', 'Number Theory', 'maths',
          ['Divisibility and primes', 'Congruences', 'Fermat, Euler and Wilson', 'Quadratic reciprocity',
           'Arithmetic functions', 'Diophantine equations', 'Cryptography'],
          ['OX', 'MIT', 'HV', 'WITS']),
        b('pde', 'Partial Differential Equations', 'maths',
          ['Classification of PDEs', 'The heat equation', 'The wave equation', 'Laplace’s equation',
           'Separation of variables', 'Fourier series and transforms', 'Method of characteristics'],
          ['OX', 'MIT', 'SU', 'UNISA', 'WITS']),
        b('linear-models', 'Regression & Linear Models', 'stats',
          ['Simple and multiple regression', 'Least squares in matrix form', 'Model diagnostics', 'Analysis of variance',
           'Experimental design', 'Generalised linear models', 'Model selection'],
          ['OX', 'UNISA', 'WITS']),
        b('stochastic-processes', 'Stochastic Processes', 'stats',
          ['Markov chains', 'Classification of states', 'Poisson processes', 'Continuous-time Markov chains',
           'Queues', 'Random walks', 'Brownian motion'],
          ['OX', 'MIT', 'WITS']),
        b('statistical-learning', 'Statistical Learning', 'stats',
          ['Multivariate data', 'Principal component analysis', 'Classification', 'Resampling and cross-validation',
           'Regularisation', 'Trees and ensembles', 'Clustering'],
          ['OX', 'WITS']),
        b('quantum-mechanics-2', 'Quantum Mechanics II', 'physics',
          ['Hilbert spaces and Dirac notation', 'Angular momentum', 'Spin', 'Identical particles',
           'Perturbation theory', 'Variational method', 'Scattering'],
          ['OX', 'MIT', 'HV', 'WITS']),
        b('statistical-physics', 'Thermal & Statistical Physics', 'physics',
          ['Laws of thermodynamics', 'Entropy and free energy', 'Microcanonical and canonical ensembles', 'The partition function',
           'Quantum statistics', 'Black-body radiation', 'Phase transitions'],
          ['OX', 'MIT', 'WITS']),
        b('condensed-matter', 'Condensed Matter Physics', 'physics',
          ['Crystal structure', 'Lattice vibrations', 'Free electron model', 'Band theory',
           'Semiconductors', 'Magnetism', 'Superconductivity'],
          ['OX', 'WITS']),
        b('nuclear-particle', 'Nuclear & Particle Physics', 'physics',
          ['Nuclear structure', 'Radioactive decay', 'Nuclear reactions', 'Particle detectors',
           'The Standard Model', 'Symmetries and conservation laws'],
          ['OX', 'WITS']),
      ],
    },
    {
      id: 'y4', name: 'Honours · Fourth Year', sub: 'Oxford MMath/MPhys year 4, South African Honours, and the first graduate courses at MIT, Stanford and Harvard',
      books: [
        b('measure-integration', 'Measure & Integration', 'maths',
          ['σ-algebras and measures', 'Lebesgue measure', 'Measurable functions', 'The Lebesgue integral',
           'Convergence theorems', 'Lᵖ spaces', 'Product measures and Fubini'],
          ['OX', 'MIT', 'HV', 'UNISA']),
        b('functional-analysis', 'Functional Analysis', 'maths',
          ['Normed and Banach spaces', 'Hilbert spaces', 'Bounded linear operators', 'Hahn–Banach theorem',
           'Baire category and its consequences', 'Spectral theory of compact operators'],
          ['OX', 'SU', 'HV', 'UNISA']),
        b('differential-geometry', 'Differential Geometry', 'maths',
          ['Curves in space', 'Surfaces', 'Curvature', 'Geodesics',
           'Smooth manifolds', 'Differential forms'],
          ['OX', 'MIT', 'SU', 'HV']),
        b('algebraic-topology', 'Algebraic Topology', 'maths',
          ['Homotopy', 'The fundamental group', 'Covering spaces', 'Simplicial complexes', 'Homology'],
          ['OX', 'HV']),
        b('mathematical-statistics', 'Advanced Statistical Theory', 'stats',
          ['Exponential families', 'Sufficiency and completeness', 'Asymptotic theory', 'Decision theory',
           'Bayesian methods', 'Time series models'],
          ['OX', 'SU', 'WITS']),
        b('general-relativity', 'General Relativity & Cosmology', 'physics',
          ['Tensors and curved spacetime', 'Einstein’s field equations', 'The Schwarzschild solution', 'Black holes',
           'Gravitational waves', 'Expanding universe'],
          ['OX', 'MIT', 'WITS']),
        b('quantum-field-theory', 'Quantum Field Theory', 'physics',
          ['Classical field theory', 'Canonical quantisation', 'Free fields', 'Interactions and Feynman diagrams',
           'Quantum electrodynamics', 'Renormalisation'],
          ['OX', 'MIT', 'HV']),
        b('research-project', 'Research Project', 'science',
          ['Choosing a question', 'Reading the literature', 'Methods', 'Writing up', 'Presenting'],
          ['OX', 'MIT', 'WITS', 'UNISA'], { blurb: 'Dissertation or thesis: compulsory in Oxford’s fourth year, MIT physics and South African Honours.' }),
      ],
    },
  ];

  function allBooks() { return SHELVES.flatMap(s => s.books.map(bk => ({ ...bk, shelf: s.id }))); }
  function find(id) { return allBooks().find(bk => bk.id === id) || null; }

  const CourseCatalog = { SHELVES, SOURCES, SUBJECTS, allBooks, find };
  if (typeof module !== 'undefined' && module.exports) module.exports = CourseCatalog;
  root.CourseCatalog = CourseCatalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
