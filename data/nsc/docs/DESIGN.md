# Mohlodi Bank: design and app spec

Mohlodi Bank is the question bank behind **Dipalo**, a Math Academy / Brilliant-style STEM learner app (Mathematics, Physical Sciences, Life Sciences) for African learners from Grade 10 to first-year university, later scaling down to Grade 9. Dipalo launches with Grade 12 exam review and practice from past NSC papers, starting with Mathematics; the bank grows to the other grades and subjects after that. This document records what we are building, how the data is shaped, and why.

## 1. Objectives

1. **Get the questions out cleanly.** Every NSC Mathematics paper, P1 and P2, starting with November 2025 and going back one paper a day. Each part keeps its number, its shared stem, its marks, and exact maths notation.
2. **Tag by skill, not only by topic.** Each answerable part is tagged with a CAPS topic and section, plus 1–3 small *skills* from a growing skill graph (the knowledge map).
3. **Make figures reproducible in code.** We keep the scanned crop as a reference only. A typed, structured spec lets the app redraw each figure in Dipalo's own style, animated where that helps.
4. **Serve learners adaptively (later).** Pick the next question, find similar questions, and work out *why* a learner failed by walking the skill graph.
5. **Keep it simple.** Plain Python, a few hundred lines, JSON files that are easy to review, and a database rebuilt from them.

Memos (answers and marking), cognitive levels, other subjects and the app come after the questions (see the roadmap).

## 2. Source of truth: JSON in git, rebuild the DB

```
papers/<paper_id>.json    one file per paper: metadata, question tree, figures
taxonomy/topics.json      CAPS units and sections (Mind the Gap Gr 12 + 2 additions)
taxonomy/skills.json      skill graph (knowledge map)
figures/<paper_id>/*.png  reference crops
```

* **Why files first:** while the schema and skill list are still moving, files are easy to diff, review in a PR, and fix by hand. `scripts/build_db.py` rebuilds the database in under a second, so changing the schema costs nothing. A database this early would lock in shapes before we have seen 10 papers.
* **Rule:** nobody edits the DB by hand. Fix the JSON, then rebuild.
* Paper id: `<year>-<nov|jun|mar>-p<n>`. Question id: `<paper_id>-<number>`, for example `2025-nov-p1-5.3.1`. Ids are stable and never reused.
* PDFs live in `sources/` (git-ignored). `sources/manifest.json` (committed) records the URL and sha256 for each one.

## 3. Question model: a tree with stems stored once

NSC questions nest: `QUESTION 5 → 5.3 "Determine the values of x for which:" → 5.3.1 g(x) ≤ f(x)`. We store a **flat list of nodes linked by `parent`**. That gives a tree that is easy to validate and maps directly onto SQL.

| field | meaning |
|---|---|
| `id`, `number`, `parent`, `level`, `order` | identity and position (`order` = document order) |
| `stem_md` | shared context that applies to this node **and all its descendants**, stored once on the highest node it applies to |
| `text_md` | the instruction for this node; null for pure containers |
| `marks` | on answerable nodes (leaves) only; `total_marks` = the printed `[n]` on QUESTION nodes |
| `answer_type` | `value, expression, equation, solution_set, inequality, set, coordinates, show_that, proof, sketch, description, reason` |
| `topic`, `subtopic` | CAPS unit / section ids (`M4`, `M4.2`) |
| `skills[]` | 1–3 skill ids the part actually tests |
| `figure_ids[]`, `table` | figures and tables (tables stored as data, not images), placed on the node they belong to |
| `cognitive_level` | CAPS level 1–4, null until we fill it from memos |
| `memo_ref` | null until memos are extracted |
| `review_status` | `extracted → reviewed → approved` |
| `notes` | ambiguities and reading decisions made during extraction |

**Text format:** Markdown plus KaTeX-compatible LaTeX inside `$…$`. Keep the paper's conventions: `;` in coordinates `(3\,;\,t)`, a decimal comma in prose (`7,8%`), and `R40 000`. A printed multiplication dot becomes `\cdot`. `2.2^{2x}` would read as a decimal, so the validator rejects it.

**Serving a part:** the app shows a leaf with its ancestors' stems, tables and figures. The SQLite view `leaf_question.context_md` already joins the stems.

## 4. Knowledge map (the Math Academy approach)

Similarity in maths is the hard problem, and plain text similarity gets it wrong. *"Solve 2·2^{2x} − 9·2^x + 4 = 0"* and *"Solve 2x² − 9x + 4 = 0"* look almost identical. The first tests exponent laws plus a substitution, and a learner who can do the second may still fail the first. Two questions can also look completely different and test the same skill.

So, as Math Academy does, the core structure is a **graph of small skills with prerequisites**:

* A **skill** is small enough to teach and test on its own: `exp.exponential-equation-substitution`, `fn.hyperbola-asymptotes`, `calc.tangent-equation`. Each skill has a home CAPS section and a list of `prerequisites`, for example `exp.exponential-equation-substitution → exp.laws-of-exponents, alg.substitution-to-quadratic`.
* Every answerable part is tagged with the **1–3 skills it actually tests**, ordered by importance. A part's topic can differ from its parent question's topic. For example, 5.6 (tangent to a parabola) is calculus inside a functions question.
* **Similar questions** = other parts that test the same skills (weighted by rank), then the same section.
* **Diagnosing a failure:** when a learner gets a part wrong, check its skills, then walk the prerequisites downward to the deepest skill they have not shown they know. Serve that skill, then come back up. Later, the memo's mark allocation shows *which step* was lost, which narrows this further.
* **Learner state** is per skill (mastery and when it was last seen, for spaced review), not per question.
* **Embeddings are only a tiebreaker:** used to rank or deduplicate within the same skill set, or to suggest skills for a new question. They are never the definition of "similar".

**How the skill list grows:** while extracting a paper, the extractor (a person or a model) picks skills from the current `skills.json` and **proposes a new skill only when none fits**. New skills enter with `status: "proposed"`. Kaelo approves, merges or renames them. Approved ids are never renamed; a replaced skill gets `deprecated` + `replaced_by`. The validator checks that every tag exists and that the graph has no cycles.

**Current seed (134 skills, all `proposed`):**
* 54 from extracting Nov 2025 P1.
* 52 from the 2025 NSC Diagnostic Report, using the strands `stat`, `ageo`, `trig` and `euc` plus a few `fn`/`alg`.
* `gen.rounding-precision`.
* 22 more from the 2016–2024 Diagnostic Reports (`research/`).
* `fin.nominal-effective` from Nov 2023 P1 Q6.1.2.
* `fn.inverse-linear` from Nov 2022 P1 Q5.2.
* `ageo.reflect-in-y-equals-x` from Nov 2021 P2 Q4.3.

`fn.interval-notation` is a prerequisite of `fn.domain-range`, `fn.inequality-from-graph`, `alg.quadratic-inequality` and `calc.concavity`. A skill may carry an optional `evidence` summary built from 909 examiner-reported errors (2016–2025): count, years flagged, a tally by match type, and up to 3 example misconceptions. The full rows stay in `research/nsc-diagnostic-maths-2016-2025.csv`. This feeds diagnosis directly: these are the known ways learners fail the skill, and how often examiners flag it shows how hard it is.

Per-question averages in `research/` come from the DBE's random sample of 100 scripts per paper from each province (about 900 per paper). The 2016–2024 error rows were mapped to skills by keyword matching and still need review.

> **Caveat:** the P2 skill mappings were first made from the examiner's report text alone, then rechecked when `papers/2025-nov-p2.json` was extracted (19 Nov 2026). **P2 Q9 is circle geometry:** 9.1 is the prescribed theorem (angle at the centre) and 9.2 applies circle theorems with a tangent. Two `euc` skills (`euc.acceptable-reasons`, `euc.parallel-line-angles`) remain tagged at unit level (`M12`). A few parts still have no perfect existing skill (4.1 write down $p$; 8.1 area and side-ratio of a rectangle); these are noted on the question nodes. `euc.tangent-perpendicular-radius` was added for 9.2.2.

**Topics:** `taxonomy/topics.json` carries over the old project's CAPS list (Mind the Gap Gr 12: 13 units, 75 sections) and adds two sections the exams need: *M7.6 Rules of differentiation* and *M12.4 Circle geometry (Gr 11, examined in P2)*. Both are marked `source: "added"`.

## 5. Figures

The crop (`figures/<paper_id>/<fig>.png`, with page, dpi and bbox) is **reference only**, for review and as a fallback. The app draws from `spec`.

| kind | spec holds |
|---|---|
| `function_graph` | axes, view window, `functions[]` (`expr` LaTeX, `plain` evaluable form, `domain`), `asymptotes[]`, labelled `points[]` with role (intercept, turning point, intersection) |
| `trig_graph` | as above, plus the degree interval and tick marks |
| `euclidean` | `points`, `segments`, `circles`, and `facts[]`: given relations such as tangent, parallel, equal sides, cyclic, angle sizes and ratios (required) |
| `analytic_geometry` | coordinate points, lines, circles with equations, angles of inclination |
| `3d_trig` | points in 3D, planes, right angles, given angles and lengths |
| `statistics_chart` | chart type (scatter, ogive, box plot, histogram) and its data |
| `table` | header and rows (tables inside question text use the node's `table` field instead) |
| `illustrative` | scene description, labels, and an animation hint (the Q3 submarine, the Q10 sheet rolled into a cylinder) |

* **Given vs derived:** every element has `given: true/false`. A derived value (the equation of `f` in Q5, worked out in 5.4) carries `reveals: "<question number>"`, so the app can hide it until that part has been answered. It can also animate it: draw the parabola once the learner has found it.
* **`exact`:** true when the spec holds every number needed to redraw the figure faithfully (all curves and points known, given or derived). It is false for decorative pictures and for diagrams drawn "not to scale" that we cannot pin down.
* **Not to scale:** NSC sketches are often not to scale. The spec stores the true maths, and the app draws it correctly.
* `review.py` replots every `function_graph` spec next to its crop, so a spec error shows up immediately.

## 6. Validation (`scripts/validate.py`, must pass before commit)

1. Paper, question, figure and skill JSON all match the JSON Schemas in `schema/`.
2. Ids follow `<paper_id>-<number>`; each parent exists and matches the number prefix; level matches depth.
3. Numbering is in document order with no gaps at any level.
4. Marks: every leaf has marks and no container does. Each QUESTION's leaves sum to its printed `[n]`, and everything sums to the paper total (150).
5. Every leaf has text, an answer type, a topic and 1–3 skills; topics, sections and skills exist; each section belongs to its unit.
6. Figures: every reference resolves, every figure is used, `used_by` matches, and the crop file exists.
7. LaTeX: `$` and braces balance, `\left`/`\right` pair up, no `.` stands in for a multiplication dot, and every formula renders with KaTeX when `npm install` has been run.
8. Skill graph: prerequisites exist and there are no cycles.

## 7. Extraction workflow (one paper a day)

1. `download_papers.py` (or a manual copy) → `sources/<paper_id>.pdf` + manifest.
2. `render_pages.py` → `pages/<paper_id>/page-N.png` at 170 dpi. DBE scans usually start at printed page 3 because the cover and instructions are dropped; `first_printed_page` records this.
3. Transcribe each page into `papers/<paper_id>.json`. A vision model can do this in one pass with this schema and the current skill list in the prompt; a person reviews the result. Check tricky notation at 400 dpi (nested radicals, small subscripts, primes).
4. Crop figures (`render_pages.py --crop`) and write the specs.
5. `validate.py` → `review.py` (side-by-side HTML) → fix → commit. Approve any new skills.

## 8. Database (later): one Postgres

One Postgres instance with a separate schema per concern. That is far easier to run than several databases, and a schema can be split out later if one ever needs to be.

* `bank`: `paper, question, figure, question_figure, topic, skill, skill_prereq, question_skill` (same shape as `build_db.py`'s SQLite). Question trees and figure specs go in **JSONB** columns where they are read whole. Use a recursive CTE or a cached `context_md` to serve leaves.
* `learner`: `attempt` (question, answer, correct, marks, time), `skill_state` (mastery, stability, due date for spaced review), `diagnosis` (failed part → suspected skill).
* `users`: accounts, profiles, schools, consent (Supabase Auth covers most of this).
* **pgvector** for embeddings of question text (tiebreaker / dedupe / skill-suggestion only).
* **Redis only if** caching is measurably needed. Postgres plus HTTP caching is enough at first.
* Hosting: **Supabase** (Postgres + Auth + Storage for crops) or **Neon** (serverless Postgres). Both include pgvector.
* The bank is rebuilt from git on every release; learner data is never rebuilt and references question and skill ids, which is why ids must be stable.

## 9. App (Dipalo) sketch

* Practice works at the level of the skill, using real exam parts as the items. Shared context (stem, figure, table) is shown once, then the parts follow one at a time.
* Figures are drawn from their specs (SVG/canvas). Derived parts are revealed after the matching answer, and transformations are animated (for example, translating `f⁻¹` 5 units right in 4.6).
* After a wrong answer: run the skill diagnosis, give a short lesson on the missing prerequisite, try a similar part, and return to the original.
* Exam mode: a full paper, timed, with a marks breakdown by skill.

## 10. Roadmap

**Product scope:** STEM (Maths, Physical Sciences, Life Sciences), Grade 10 to first-year university, later Grade 9. Curricula: CAPS (DBE) first, then IEB and SACAI (same CAPS skill graph), then Cambridge IGCSE/AS with original items. Languages: English first, then Afrikaans, isiZulu, Sesotho, Swahili, French.

**Rollout:** (a) launch: Grade 12 exam review/practice (Exam Prep mode) for Maths, then Physical Sciences and Life Sciences; (b) Grades 10–11 for the same subjects, reusing the skill graph's prerequisites; (c) first-year university STEM (bridging from matric); (d) Grade 9.

**Question bank (now):**

1. **Now:** Nov 2025 P1 ✅ → P2 ✅ (skill mappings rechecked on extraction) → Nov 2024 P1 ✅ and P2 ✅ (no new skills) → Nov 2023 P1 ✅ (`fin.nominal-effective`) and P2 ✅ (no new skills) → Nov 2022 P1 ✅ (`fn.inverse-linear`) and P2 ✅ (no new skills) → Nov 2021 P1 ✅ (no new skills) and P2 ✅ (`ageo.reflect-in-y-equals-x`) → Nov 2020 P1 ✅ (no new skills) and P2 ✅ (no new skills) → Nov 2019 P1 ✅ (no new skills) and P2 ✅ (no new skills) → Nov 2018 P1 ✅ (no new skills) and P2 ✅ (no new skills) → Nov 2017 P1 ✅ (no new skills) and P2 ✅ (no new skills) → Nov 2016 P1 ✅ (no new skills) and P2 ✅ (no new skills) → earlier years back to 2008, one year a day; approve skills as they appear.
2. **Memos:** extract marking guidelines into `memos/<paper_id>.json` (answer, mark-by-mark steps); fill `memo_ref` and `cognitive_level`.
3. **Skill graph consolidation** after about 6 papers: merge near-duplicates, add the missing prerequisite links, attach a lesson link to each skill.
4. **Figure renderer prototype** (function graphs first, then Euclidean geometry).
5. **Postgres + API**, then the Dipalo app; embeddings last.
