# AI Study Buddy - Learning Platform

A research platform built for my thesis project at Technical University of Munich. The goal is to study how effective avatar-based learning is compared to traditional text-based learning for teaching AI image generation concepts.

## What This Project Does

This platform lets participants learn about AI image generation through two different modes:
- **Text Mode**: A chat interface where you can ask questions to an AI tutor
- **Avatar Mode**: An interactive AI avatar that talks to you and responds to voice

The study collects data on knowledge gain, engagement, and user experience to compare both approaches.

## How It Works

The study flow goes like this:
1. Welcome page → Consent form
2. Demographics questionnaire
3. Pre-test (to measure baseline knowledge)
4. Learning session (either Text or Avatar mode)
5. Post-test (to measure what was learned)
6. Open feedback questions
7. Completion

## Project Structure

```
src/
├── components/          # UI components
│   ├── ui/             # Base components (buttons, cards, etc.)
│   ├── modes/          # Text and Avatar mode interfaces
│   ├── admin/          # Admin dashboard for researchers
│   └── __tests__/      # Unit tests
├── pages/              # All the pages (Welcome, Learning, PostTest, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Helper functions
│   └── __tests__/      # Tests for helpers
├── data/               # Question and slide data
└── test/               # Test setup and integration tests

supabase/
└── functions/          # Backend API functions
```

## Tech Stack

- **Frontend**: React with TypeScript and Vite
- **Styling**: Tailwind CSS with shadcn/ui components  
- **Backend**: PostgreSQL database with serverless functions
- **AI**: OpenAI for chat responses, Anam AI for avatar streaming
- **Testing**: Vitest with React Testing Library

## Running Tests

If you want to run the tests locally:

```bash
# Install dependencies first
npm install

# Run all tests once
npx vitest run

# Run tests in watch mode (reruns when files change)
npx vitest

# Generate coverage report
npx vitest run --coverage
```

### Test Coverage

The tests cover:
- **Component tests**: LikertScale, ConfidenceSlider components
- **Utility tests**: Helper functions, permission system
- **Data tests**: API request validation, data schemas
- **Integration tests**: Edge function contracts

## Admin Dashboard

The admin panel at `/admin` lets researchers:
- View all participant sessions and responses
- Export data as CSV for analysis
- See statistics and completion rates
- Edit learning content and survey questions

Access requires an authorized email address.

## Development

To run locally:

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:8080`

## Author

Built by Jakub Majewski as part of a research project at TUM.

Mentor: Efe Bozkir
