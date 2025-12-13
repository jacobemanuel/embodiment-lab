# AI Image Generation Learning Platform

A research platform for studying the effectiveness of avatar-based vs text-based learning in AI image generation education.

## Project Overview

This platform was built as part of a research study comparing two learning modalities:
- **Text Mode**: Traditional chat-based interaction with an AI tutor
- **Avatar Mode**: Interactive AI avatar (using Anam AI) that speaks and responds to voice input

The study measures knowledge gain, engagement, and user perception across both modalities.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (via Lovable Cloud)
  - PostgreSQL database with RLS policies
  - Edge Functions for API logic
  - Real-time subscriptions
- **AI Integration**: 
  - OpenAI GPT for text chat
  - Anam AI for avatar streaming
- **Testing**: Vitest + React Testing Library

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── modes/          # Text/Avatar mode components
│   ├── admin/          # Admin dashboard components
│   └── __tests__/      # Component unit tests
├── pages/              # Route pages (Welcome, Learning, PostTest, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and helpers
│   └── __tests__/      # Utility function tests
├── data/               # Static data (questions, scenarios)
├── integrations/       # Supabase client and types
└── test/               # Test setup and integration tests
    └── integration/    # API and validation tests

supabase/
└── functions/          # Edge functions (chat, anam-session, etc.)
```

## Testing Architecture

### Unit Tests

Located in `src/components/__tests__/` and `src/lib/__tests__/`:

| Test File | What It Tests |
|-----------|---------------|
| `LikertScale.test.tsx` | Likert scale component rendering and interaction |
| `ConfidenceSlider.test.tsx` | Slider component with value changes |
| `utils.test.ts` | Utility functions like `cn()` for class merging |
| `studyData.test.ts` | Data persistence functions (mock Supabase calls) |
| `permissions.test.ts` | Role-based access control logic |

### Integration Tests

Located in `src/test/integration/`:

| Test File | What It Tests |
|-----------|---------------|
| `edgeFunctions.test.ts` | Edge function request/response validation |
| `dataValidation.test.ts` | Zod schema validation for all data types |

### What Each Test Verifies

**Component Tests:**
- Components render correctly with different props
- User interactions trigger correct callbacks
- Accessibility (proper ARIA attributes, keyboard navigation)
- Edge cases (empty states, boundary values)

**Data Tests:**
- Supabase edge functions are called with correct parameters
- Data transformations are accurate
- Error handling works properly

**Validation Tests:**
- Input data meets schema requirements
- Invalid data is rejected with appropriate errors
- Boundary conditions (max lengths, required fields)

## Running Tests

### Prerequisites

You need Node.js installed. Clone the repository from GitHub first:

```bash
git clone <your-github-repo-url>
cd <project-folder>
npm install
```

### Run All Tests

```bash
npx vitest run
```

This runs all tests once and shows pass/fail results.

### Run Tests with Watch Mode

```bash
npx vitest
```

Tests re-run automatically when you change files (useful during development).

### Run Specific Test File

```bash
npx vitest run src/components/__tests__/LikertScale.test.tsx
```

### Generate Coverage Report

```bash
npx vitest run --coverage
```

This creates a `coverage/` folder with HTML reports showing which lines of code are tested.

## Example Test Output

When you run `npx vitest run`, you'll see something like:

```
 ✓ src/components/__tests__/LikertScale.test.tsx (5 tests) 
 ✓ src/components/__tests__/ConfidenceSlider.test.tsx (4 tests)
 ✓ src/lib/__tests__/utils.test.ts (3 tests)
 ✓ src/lib/__tests__/studyData.test.ts (8 tests)
 ✓ src/lib/__tests__/permissions.test.ts (6 tests)
 ✓ src/test/integration/edgeFunctions.test.ts (5 tests)
 ✓ src/test/integration/dataValidation.test.ts (12 tests)

 Test Files  7 passed (7)
      Tests  43 passed (43)
```

## Security Considerations

- All database tables use Row Level Security (RLS)
- Sensitive data (correct answers) hidden via database views
- API keys stored in Supabase secrets, not in code
- Admin access restricted by email whitelist

## Database Schema

Key tables:
- `study_sessions` - Tracks participant sessions and mode assignment
- `demographic_responses` - Participant demographics
- `pre_test_responses` / `post_test_responses` - Test answers
- `avatar_time_tracking` - Avatar interaction duration per slide
- `study_questions` - Questions (admin-editable)
- `study_slides` - Learning content (admin-editable)

## Admin Dashboard

Accessible at `/admin` (requires authorized email):
- View all participant responses
- Edit questions and slides (live deployment)
- Export data as CSV/JSON
- Statistical analysis with significance testing
- API control panel (owner only)

## How to Demo for Grading

1. **Live Application**: Visit the deployed URL and walk through the study flow
2. **Admin Panel**: Show the `/admin` dashboard with real data
3. **Code Quality**: Show the organized file structure in the repository
4. **Tests**: Run `npx vitest run` locally to show passing tests
5. **Coverage**: Run `npx vitest run --coverage` to show test coverage

## Author

Built as a research platform for studying AI-assisted learning effectiveness.
