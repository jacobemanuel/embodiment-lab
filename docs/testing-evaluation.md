# Testing & Evaluation (course checklist)

This project already has unit + integration tests, plus a lightweight E2E smoke test for routing. For the course “Testing & Evaluation” milestone, the rest is a **structured pilot** + **reporting checklist** (manual, but repeatable).

## 1) Automated test coverage

- **Unit**: UI components and utilities (Vitest).
- **Integration (mocked)**: edge‑function call contracts + validation rules (Vitest).
- **E2E smoke**: routing sanity check in `src/test/e2e/AppSmoke.test.tsx`.

## 2) Pilot / user‑based evaluation (structured)

Run with a small group (5–10 participants) before formal data collection:

- Recruit 5–10 users from the target population.
- Run **both modes** (text + avatar) across participants.
- Capture:
  - Completion rate and average duration.
  - Data quality flags per session.
  - Any friction points (navigation, blocked progress, unclear questions).
- Log qualitative notes (confusion, trust, engagement).

## 3) Reporting checklist (what to include in your course report)

- **Reliability**: test results + known gaps (no full E2E automation).
- **Usability**: pilot feedback highlights + fixes applied.
- **Data quality**: flag rates, common issues, how they were handled.
- **Learning outcomes**: pre/post gains by mode.

## 4) Metrics to report (examples)

- **Pre/Post knowledge gain**: mean, median, distribution.
- **Likert scale shifts**: trust/engagement/satisfaction by mode.
- **Completion stats**: drop‑off rate, average session time.
- **Optional (classification tasks)**:
  - Accuracy, precision, recall, F1.
  - Confusion matrix (if you treat knowledge questions as labels).

Note: metrics above are reported from exported CSV/PDF data; they are not auto‑computed inside the app.
