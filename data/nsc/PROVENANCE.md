# NSC Mathematics bank (provenance)

Trimmed copy of the Mohlodi question bank (sibling of Togisumasu), committed so the Grade 12 CAPS course can import past papers without that repository.

Included:

- `papers/` — November NSC Mathematics Paper 1 and Paper 2, 2016–2025 (20 papers). Each file is the extracted question tree plus figure **specs**. Every paper totals 150 marks.
- `taxonomy/topics.json` — 13 CAPS units (Mind the Gap, plus two added sections). Stable unit codes `M1`–`M13`.
- `taxonomy/skills.json` — 133 skills. Every skill is still `status: "proposed"`, so ids may be renamed. Togisumasu maps them through the `bank_skill_map` lookup table and does not foreign-key questions to these ids.
- `schema/` — JSON Schema for a paper, a question node, a figure and a skill.
- `docs/DESIGN.md` — the bank's own design note (question tree, skill graph, figures drawn from `spec`).

Left out on purpose:

- `figures/**/*.png` — reference crops of the scanned papers (about 15 MB). Production diagrams are drawn from the `spec` objects inside each paper file, not from the crops.
- `research/` — diagnostic-report spreadsheets. They are not needed to teach or to import questions.

Reading note kept from the source: in `papers/2016-nov-p2.json`, question 2's histogram has class frequencies 24, 71, 38, 23 and 4 printed on the bars (they sum to 160). Those frequencies were read off the histogram because the cumulative-frequency table is only in the answer book, which is not in the PDF. Question 2.2's range uses the stated shortest and tallest heights (1,39 m and 2,21 m), not the class endpoints.

November 2025 Paper 1 and Paper 2 marking guidelines are in `memos/` (see `memos/PROVENANCE.md`). Other years are not in this snapshot yet. Where a memo is missing, a key can still be filled by two agreeing offline solutions. A flagged or missing key is not served. A memo key replaces either of those.

Papers from 2022 onward are the exam pool. Papers from 2016–2021 are the practice pool. The split is a `CHECK` on `nsc_papers` plus the `nsc_practice_leaves` and `nsc_exam_papers` views, not a label the UI is trusted to honour.
