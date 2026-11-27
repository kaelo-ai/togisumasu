# NSC marking guidelines

Official DBE marking memoranda, transcribed in the sibling Mohlodi bank (commit `f9d767d`) and copied here unchanged so Togisumasu marks from the memo rather than from a model.

Included, all November Mathematics, English only, one file per paper:

| Pool | Papers |
| --- | --- |
| Exam (mock exams only, never quizzes) | 2022, 2023, 2024, 2025, Paper 1 and Paper 2 |
| Practice (quizzes, behind prerequisites) | 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, Paper 1 and Paper 2 |

The pool comes from the paper year, not from the memo: importing a memo never moves a 2022+ paper into quizzes.

Each file has one part per answerable question, with the same id as the question leaf (`memo_ref`): the final answer, the working, the tick-by-tick allocation, alternative methods, and examiner notes. `schema/memo.schema.json` is the JSON Schema. Every paper's parts total 150 marks.

## Typos in the official memos

Where the printed memo has an error, Mohlodi transcribed it as printed and explained it in a note on the part, an alternative or a step (for example 2014 P1 3.1.3, 2014 P2 3.4.1, 2015 P1 9.5, 2015 P2 6.1, 2016 P2 4.4.2, 2017 P1 2.2.2, 2019 P2 8.2.1, 2021 P1 3.4, 2023 P1 8.4). The official 2015 Paper 2 memo omits QUESTION 3.4 and prints a total of 149; the missing 1-mark answer $\mathrm{RS}=7\sqrt{2}$ was derived from the rest of question 3 and is stored with a note. Togisumasu does not correct these. The notes are stored on the key as `memo_notes` and shown with the official answer after an exam; `npm run keys:memos` lists them in its output.

## Import

`npm run keys:memos` (also run on startup) writes one key per part with provenance `memo`, replacing any `llm_double` or `flagged` key, and is idempotent. The deterministic checker in `public/core.js` scores these answer forms:

- single values and lists of roots; ordered lists such as the next two terms
- inequalities and intervals, including `or`/`∪`, infinity, and excluded points (`x ∈ R, x ≠ 3`)
- coordinate pairs, sets of pairs, and simultaneous solutions (`x = 2, y = 1 or …`)
- trig general solutions (`x = 30° + k·360°, k ∈ Z`), compared as residues so equivalent families pass
- expressions in a parameter (`k`, `n`, `p`) and equations in rearranged forms, by numeric sampling in degrees
- Euclidean statement-and-reason chains

Sketches, free-form proofs, written explanations and a few compound answers (a function with its domain, `log₂`) stay on the key with `checkable: false`. Exams show them with the memo answer and do not score them; quizzes never serve them.
