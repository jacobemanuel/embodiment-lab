# Embodiment Lab – AI Study Buddy

Research platform for comparing AI avatar tutoring vs. text-based tutoring in an AI image generation study. Built for a TUM research project to measure knowledge gain, engagement, and user experience across learning modes.

## Participant Flow

1. Welcome + consent
2. Demographics
3. Pre-test (baseline)
4. Learning session (Text or Avatar mode)
5. Post-test (Likert + knowledge + open feedback)
6. Completion + optional download of responses

## Roles & Access

- **Participants**: no login required.
- **Owner**: full control (validation, exports, API settings).
- **Admin**: content editing, exports, API toggles.
- **Viewer/Mentor**: read-only research view.

Access is enforced via Supabase Auth and role checks in `src/lib/permissions.ts`.

## Data Captured

- Session metadata (mode, timestamps, status, flags)
- Demographics and pre/post responses
- Scenario ratings and dialogue turns
- Tutor dialogue (text + avatar)
- Slide/page timing (avatar + text, including per-page time)
- Data quality flags + validation status

Participants can download their own responses as CSV; researchers can export CSV/PDF from the admin panel.

## Admin Dashboard (Research Panel)

- Overview analytics and completion metrics
- Sessions table with per-session PDF export + timing breakdown
- Response analytics + open feedback review
- Slide and question editors
- API settings (Lovable/OpenAI gateway + Anam)
- Audit log and permission summary

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **AI**: Lovable AI gateway (OpenAI) for text tutor; Anam AI for avatar streaming
- **Exports**: jsPDF + CSV utilities
- **Charts**: Recharts

## Architecture Notes

- Primary writes go through Supabase Edge Functions (`chat`, `anam-session`, `save-study-data`, `save-avatar-time`, `complete-session`, etc.).
- If edge functions are unavailable, the app falls back to direct table inserts and stores telemetry as `__meta_*` rows in `post_test_responses`.

## Repo Structure

```
src/
  components/
    admin/
    modes/
    ui/
  pages/
  hooks/
  lib/
  utils/
  data/
  test/
supabase/
  functions/
  migrations/
```

## Local Development

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

Frontend is published via Lovable; Supabase provides the database, auth, and edge functions.

## Author

Jakub Majewski (TUM research project)  
Mentor: Efe Bozkir
