# NSC marking guidelines

Official DBE marking memoranda, transcribed in the sibling Mohlodi bank (commit `0dbfa75`) and copied here so Togisumasu can mark from the memo rather than from a model.

Included now:

- `2025-nov-p1.json` and `2025-nov-p2.json` — November 2025 Mathematics Paper 1 and Paper 2. English only. One part per answerable question, with the same id as the question leaf (`memo_ref`). Each part has the final answer, the working, the tick-by-tick allocation, any alternative methods, and examiner notes.
- `schema/memo.schema.json` — the JSON Schema for that file. Later years (2022 back to 2016) will use the same shape: drop `memos/<year>-nov-p<n>.json` in this directory and run `npm run keys:memos`.

`npm run keys:memos` writes one key per part with provenance `memo`, which replaces an `llm_double` or `flagged` key for that question. The steps, marks and alternatives are stored with the key. A geometry memo that prints statement/reason ticks becomes a statement-and-reason chain the deterministic checker can mark. Sketches, free-form proofs and other answers that do not reduce to a number, expression or statement/reason chain stay on the key for the exam review, and are not auto-marked.

These papers are in the exam pool. The memo does not move them into quizzes.
