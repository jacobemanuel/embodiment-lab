# P6: AI Study Buddy
## Exploring Trust and Engagement toward Embodied AI Agents for AI Literacy

This repo is the full study system (not just the learning UI). It includes the participant flow *and* the admin/owner dashboard used to validate data, review flags, and export datasets for analysis.

## What this is

AI Study Buddy is a research platform that compares two learning modes:
- **Text Mode**: chat-based tutor.
- **Avatar Mode**: embodied tutor experience.

Participants go through a structured study, and admins/owners get a full backend to monitor quality, validate sessions, and export clean data.

## Participant flow

1. Welcome + consent
2. Demographics
3. Pre-test (baseline)
4. Learning session (Text or Avatar mode)
5. Post-test (Likert + knowledge + open feedback)
6. Completion + optional download of responses

## Roles and access

- **Participant**: no login required, can only complete the study once per device.
- **Admin**: edits content, reviews sessions, exports data, requests validation.
- **Owner**: full control (accept/ignore sessions, delete sessions, export everything).
- **Mentor / Viewer**: read-only access to results and dashboards.

Access is enforced via Supabase Auth and role checks in `src/lib/permissions.ts`.

## Eligibility

- **18+ only**: the consent statement (on the main consent page and the consent sidebar) explicitly requires participants to confirm they are at least 18.

## Admin + owner toolkit (what you actually get)

- Live sessions table with status, flags, validation state
- Full response viewer with demographic + pre/post + feedback answers
- Slide and question editors (content is dynamic, not hardcoded)
- API toggles and key management
- Export system (CSV + PDF, session-level and global)
- Timing analytics (per-page and per-slide)
- Dialogue logs (text + avatar transcript where available)

## Guardrails and data quality

The study blocks shortcuts and flags suspicious behavior automatically.

User-facing guardrail messages you will see:
- "This device already completed the study. To protect data quality, repeat participation is blocked."
- "Please complete the previous steps first."
- "You have already completed this section."
- "Your session has been reset. Please start from the beginning."

### Data quality requirements (to pass without flags)

These are the minimum thresholds used by the system:
- Demographics page time >= 15s
- Pre-test page time >= 30s
- Post-test page time >= 45s
- Learning page time >= 24s (based on 3 slides x 8s minimum)
- Average slide view time >= 8s
- Fast answers (<3s) < 50%
- Average answer time >= 2s

### What triggers a flag

Flags are raised when:
- A page is completed faster than the minimum time
- More than 50% of answers are too fast
- Average answer time is below the minimum
- Average slide view time is below the minimum

Flags roll up into a **suspicion score**. Sessions with a score > 0 require validation:
- **Accepted** sessions are included in stats and exports
- **Ignored** sessions are excluded

## What we monitor (for validation)

Admins/owners can see:
- Session start/end timestamps + total duration
- Per-page timing (consent, demographics, pre, learning, post)
- Per-slide timing (avatar + text)
- Question-level answer timing (fast answers, averages)
- Full answer set (demographics, pre, post, feedback)
- Tutor dialogue transcript (text + avatar, when captured)
- Scenario responses (if enabled)
- Suspicious flags + validation decisions

## Tech stack

- **Frontend**: React + Vite + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **AI**: OpenAI GPT-5 mini for text + avatar tutoring
- **Exports**: jsPDF + CSV utilities
- **Charts**: Recharts

## Architecture notes

- Primary writes go through Supabase Edge Functions (`chat`, `save-study-data`, `save-avatar-time`, `complete-session`, etc.).
- If edge functions are unavailable, the app falls back to direct table inserts and stores telemetry as `__meta_*` rows in `post_test_responses`.

## Local development

```
npm install
npm run dev
```

App runs at `http://localhost:8080`.

Required env:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Tests

```
npx vitest
npx vitest run
```

## Deployment

Frontend is published via the project hosting workflow; Supabase provides the database, auth, and edge functions.

## Author

Jakub Majewski (TUM research project)  
Mentor: Efe Bozkir
