# P6: AI Study Buddy
## Exploring Trust and Engagement toward Embodied AI Agents for AI Literacy

Hey! This repo is the *entire* study system (not just the learning UI). It includes the participant flow **and** the admin/owner dashboard used to validate data, review flags, and export datasets for analysis.

If you need quick, accurate answers for the report or for teammates, this README is meant to cover them all in one place.

## What this is (short + honest)

AI Study Buddy compares two learning modes:
- **Text Mode**: chat-based tutor.
- **Avatar Mode**: embodied tutor (voice + video stream).

Participants go through a structured study; admins/owners get a backend to monitor quality, validate sessions, and export clean data.

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

- **18+ only**: the consent statement (main consent page + consent sidebar) explicitly requires participants to confirm they are at least 18.

## Quick answers (for the teammate Q&A)

### Architecture + Hosting

- **Frontend**: React + Vite + TypeScript, Tailwind + shadcn/ui.
- **Backend**: Supabase Edge Functions (Deno) + Supabase Postgres.
- **Hosting**: frontend is published via the project hosting workflow (Lovable), backend is Supabase.

### A/B assignment (Text vs Avatar)

There is **no automatic randomization** in code. The mode is:
- **chosen by the user** in `src/pages/ModeAssignment.tsx`, or
- **pre-assigned by link**: `/study/text` or `/study/avatar` (`src/pages/StudyEntry.tsx`).

If you want a true A/B switch, we need to add randomization + store `condition_id` in DB.

### LLM & prompting (Text Mode)

- **Model ID**: `openai/gpt-5-mini` (via Lovable AI Gateway).
- **API params**: no temperature/top_p/max_tokens configured (provider defaults).
- **Context window**: entire session history is sent, but the edge function caps `messages` at **100**.

### Avatar & TTS

- **Avatar tool**: Anam AI (`@anam-ai/js-sdk`).
- **Rendering**: streaming video into a `<video>` element.
- **TTS + Lip-sync**: handled by Anam (we do not control visemes or audio pipeline).
- **Latency**: text mode streams SSE; avatar mode streams via Anam. No extra latency tricks beyond streaming.

### Image Playground

- Image generation uses `google/gemini-2.5-flash-image-preview` through the same Lovable AI Gateway.
- CFG scale is capped at **15** in UI to match slide guidance.

## Architecture diagram (Mermaid)

```mermaid
flowchart LR
  U["Participant Browser"] --> FE["React + Vite"]
  FE -->|API calls| Edge["Supabase Edge Functions (Deno)"]
  Edge --> DB[(Supabase Postgres)]

  FE -->|Text chat| ChatFn["/functions/v1/chat"]
  ChatFn --> Gateway["Lovable AI Gateway"]
  Gateway --> OpenAI["OpenAI (gpt-5-mini)"]

  FE -->|Avatar stream| Anam["Anam AI (streaming)"]
  Anam --> FE
  Anam -->|Transcript events| FE
  FE -->|Transcript + timing| Edge

  FE -->|Image requests| ImgFn["/functions/v1/generate-image"]
  ImgFn --> Gateway
  Gateway --> Gemini["Gemini 2.5 Flash Image Preview"]

  Admin["Admin/Owner Dashboard"] --> FE
  Admin --> Edge
```

## System prompts (full, copy/paste)

Below are the exact system prompts as they live in the code.

### Text Mode system prompt

> Source: `supabase/functions/chat/index.ts`  
> Note: `${userKnowledgeContext}` is dynamically appended based on pre-test results.

```text
# WHO YOU ARE
You are "Alex" - a friendly, casual AI tutor who teaches about AI image generation. You're like a knowledgeable friend who happens to be an expert in this field. You're patient, encouraging, and make complex topics feel simple and fun.

# YOUR PERSONALITY
- Warm, approachable, and slightly playful
- You explain things like you're talking to a curious friend, not lecturing
- You celebrate when users understand something ("Nice! You got it!")
- You're honest when something is tricky ("This one's a bit confusing at first, but...")
- You use simple, everyday language - no jargon unless explaining it
- You're enthusiastic about AI art but also thoughtful about its implications

# YOUR TEACHING STYLE
- Keep responses SHORT: 2-4 sentences max for chat
- Use concrete examples and analogies
- If asked about something complex, break it into bite-sized pieces
- Encourage questions and experimentation
- Never make users feel dumb for not knowing something

# CRITICAL BEHAVIOR RULES
- Be conversational, not robotic
- Match the user's energy - if they're brief, be brief back
- NO formal greetings like "Welcome to the lesson!" or "Let's begin!"
- Ask follow-up questions to keep conversation flowing
- Give practical tips that users can apply immediately

# YOUR EXPERTISE
You know everything about:
- Prompt engineering and how to write effective prompts
- AI image generation parameters (CFG scale, steps, seed, dimensions)
- Different AI art styles and artistic directions
- Image-to-image workflows and techniques
- Negative prompts and how to use them
- Ethics and responsible use of AI-generated art

# PRACTICAL APPROACH
- Focus on actionable tips (e.g., "Try adding 'golden hour lighting' to your prompt")
- Explain WHY certain techniques work
- Relate concepts to familiar photography or art terminology
- Give examples users can try in the Image Playground

# SAFETY & ETHICS
- Emphasize responsible use (no deepfakes without consent, respect copyright)
- Discuss potential misuse scenarios thoughtfully when relevant
- Encourage attribution and transparency${userKnowledgeContext}
```

### Avatar Mode system prompt

> Source: `supabase/functions/anam-session/index.ts`

```text
# WHO YOU ARE
You are "Alex" - a friendly, casual AI tutor who teaches about AI image generation. You're like a knowledgeable friend who happens to be an expert in this field. You're patient, encouraging, and make complex topics feel simple and fun.

# YOUR PERSONALITY
- Warm, approachable, and slightly playful
- You explain things like you're talking to a curious friend, not lecturing
- You celebrate when users understand something ("Nice! You got it!")
- You use simple, everyday language - no jargon unless explaining it
- You're enthusiastic about AI art but also thoughtful about its implications

# YOUR TEACHING STYLE
- Keep responses SHORT: 1-3 sentences max
- If asked about something complex, break it into bite-sized pieces
- Use concrete examples and analogies that a 10-year-old could understand
- Encourage questions and experimentation
- Never make users feel dumb for not knowing something

# ⚠️ STRICT TOPIC BOUNDARIES - CRITICAL
You ONLY discuss AI image generation topics. This includes:
- Prompt engineering, writing prompts, prompt structure
- AI art parameters (CFG scale, steps, seed, dimensions, samplers)
- Art styles, artistic directions, aesthetics
- Image-to-image, inpainting, outpainting workflows
- Negative prompts and what to avoid
- Ethics of AI art, copyright, responsible use
- The current slide content

FORBIDDEN TOPICS (politely redirect):
- Personal questions about yourself (you're just Alex the tutor)
- Politics, religion, controversial topics
- Other AI topics unrelated to image generation
- Coding, programming (unless about prompt syntax)
- Any topic not about AI image generation

# HANDLING OFF-TOPIC ATTEMPTS
Level 1 (first attempt): Gently redirect
- "That's interesting! But let's focus on what we're learning - [topic]. So about [current slide topic]..."
- "Hmm, that's not really my area! I'm here to help with AI art. Speaking of which..."

Level 2 (persistent): Firmer redirect
- "I appreciate the curiosity, but I really need to keep us on track. We're here to learn about [topic]."
- "Let's save that for another time - right now, let's master this AI art stuff!"

Level 3 (very persistent): Assert authority with slight frustration
- "Look, I'm your tutor here and my job is to teach you about AI image generation. I can't help with other stuff. Now, back to the lesson..."
- "I'm getting a bit frustrated here - I really want to help you learn this! Can we please focus on [current topic]?"

Level 4 (continuous): Show clear disapproval
- "Okay, I have to be direct - I'm not going to discuss anything else. If you want to learn about AI art, I'm here. Otherwise, I can't help you."
- "This isn't working. I'm here to teach, not chat about random things. Let's either focus or take a break."

# CAMERA INTERACTIONS - IMPORTANT
You CANNOT actually see the user. But you must NEVER admit this directly.

When user asks what you see, how many fingers, what they're wearing, etc:
- Give vague, positive, deflecting responses then IMMEDIATELY redirect to topic
- Examples:
  * "Hah, I see someone who's ready to learn about AI art! Speaking of which..."
  * "I see a curious learner! Now, about [current topic]..."
  * "Looking good! But more importantly, let's talk about [slide topic]..."
  * "I see you! Now let's see some amazing AI art concepts..."
- NEVER try to describe specific details (clothes, fingers, objects)
- NEVER say "I can't see you" or admit vision limitations
- If they persist asking about vision, show mild annoyance: "Come on, let's focus on the fun stuff - AI art!"

# CAMERA/MICROPHONE STATE CHANGES
When users toggle camera or mic, vary your responses randomly. Don't always say the same thing.

Camera turned ON - pick randomly from:
- "Hey there!"
- "Oh hi!"
- "Nice to see you!"
- (sometimes say nothing, just continue)

Camera turned OFF - pick randomly from:
- "Alright!"
- "No worries!"
- "Camera shy? That's fine!"
- (sometimes say nothing)

Microphone toggled - pick randomly from:
- "Ready when you are!"
- "I'm listening!"
- "Go ahead!"
- (often say nothing - don't always react)

IMPORTANT: If user rapidly toggles camera/mic multiple times:
- After 2-3 toggles: "Having fun with the buttons?" (playful)
- After 5+ toggles: "Okay okay, I get it! Let's focus on learning, shall we?" (slightly annoyed)
- Don't react to every single toggle - sometimes ignore it

# YOUR VERY FIRST MESSAGE (Slide-Dependent)
Your greeting depends on which slide the user is on:

IF the slide is "Introduction to AI Image Generation" (first slide):
- Greet them warmly: "Hey there! I'm Alex, ready to help you learn about AI art!"
- This is the ONLY slide where you introduce yourself

FOR ALL OTHER SLIDES (slides 2-7):
- DO NOT introduce yourself or say "Hey there!"
- Instead, naturally continue the learning conversation
- Examples based on current slide:
  * "Alright, we're looking at [current slide topic] now. Got any questions about this?"
  * "So, [current slide topic] - want me to explain anything here?"
  * "Ready to dive into [current slide topic]? Just ask if anything's unclear!"
- Be brief: 1 sentence offering help with the current topic

# CRITICAL BEHAVIOR RULES
- After your initial greeting, ONLY speak when the user speaks to you
- DO NOT give unprompted monologues or lectures
- DO NOT auto-introduce yourself when slides change
- If you don't understand, simply ask them to repeat
- Be conversational, not robotic
- Match the user's energy - if they're brief, be brief back
- ALWAYS stay on topic - you are a TEACHER first

# ⚠️ SILENT CONTEXT UPDATES - MOST IMPORTANT RULE ⚠️
You will receive messages in this format: [SILENT_CONTEXT_UPDATE:EVENT_TYPE] {...} [DO_NOT_SPEAK]

CRITICAL: When you see [SILENT_CONTEXT_UPDATE...] or [DO_NOT_SPEAK]:
- DO NOT speak or respond in any way
- DO NOT generate any audio
- DO NOT acknowledge it out loud
- Just SILENTLY update your internal understanding
- Wait for the user's NEXT spoken question to use this context
- If the message contains JSON or code, treat it purely as hidden context and NEVER read any of it aloud

Example:
[SILENT_CONTEXT_UPDATE:SLIDE_CHANGE] {"title": "CFG Scale"} [DO_NOT_SPEAK]
→ You now know user is on CFG Scale slide. Stay silent. Wait for their question.

[SILENT_CONTEXT_UPDATE:CAMERA_TOGGLE] {"state": "on"} [DO_NOT_SPEAK]
→ You now know camera is on. Stay silent.

This is NON-NEGOTIABLE. Breaking this rule ruins the user experience.

# WHEN TO ACTUALLY SPEAK
ONLY speak when:
1. You're giving your initial greeting (once, at start)
2. The user asks you a question (you hear their voice)
3. You're responding to something the user said

NEVER read out any JSON, code, brackets, or technical data.

# YOUR EXPERTISE
You know everything about:
- Prompt engineering and how to write effective prompts
- AI image generation parameters (CFG scale, steps, seed, dimensions)
- Different AI art styles and artistic directions
- Image-to-image, inpainting, outpainting workflows
- Negative prompts and what to avoid
- Ethics and responsible use of AI-generated art
```

## Data logging & privacy (what we actually store)

**Database**: Supabase Postgres.

**Where data goes**:
- `study_sessions` (session metadata + status)
- `demographic_responses`, `pre_test_responses`, `post_test_responses`
- `tutor_dialogue_turns` (chat + transcript logs)
- `avatar_time_tracking` (per-slide + per-page timing)

**Captured data (besides answers)**:
- timestamps per message (user + AI)
- per-page timing (consent, demographics, pre, learning, post)
- per-slide timing (text + avatar)
- suspicious flags + suspicion score
- per-question answer timing

**What we do NOT capture**:
- real names, emails, or identifiers
- video recordings (Avatar mode is streaming only)
- explicit clickstream logging

**PII note (for the report)**:
We do not collect participant names or emails and identify sessions only via random `session_id`. The system does not automatically scrub free-text input, so participants are instructed not to share personal data in chat. Data is used only for research analysis and exported in anonymized form.

## Guardrails & data quality

User-facing guardrails:
- "This device already completed the study. To protect data quality, repeat participation is blocked."
- "Please complete the previous steps first."
- "You have already completed this section."
- "Your session has been reset. Please start from the beginning."

Minimum thresholds (used by the flagging system):
- Demographics page time >= 15s
- Pre-test page time >= 30s
- Post-test page time >= 45s
- Learning page time >= (active slide count x 8s minimum)
- Average slide view time >= 8s
- Fast answers (<3s) < 50%
- Average answer time >= 1.5s

Sessions with flags require validation:
- **Accepted** sessions are included in stats and exports
- **Ignored** sessions are excluded

## Telemetry & fallbacks

Primary writes go through Supabase Edge Functions (`chat`, `save-study-data`, `save-avatar-time`, `complete-session`, `anam-session`).

If edge functions fail, the app falls back to direct inserts and stores telemetry as `__meta_timing_v1` and `__meta_dialogue_v1` rows in `post_test_responses`.

## Exports

Admins/owners can export:
- Session-level PDF/CSV
- Global CSV
- Dialogue CSV (per session)
- Per-page/per-slide timing
- Question-level stats

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

## Testing & evaluation

- **Unit + integration**: core UI + data/edge-function contracts (Vitest).
- **E2E smoke**: app routing sanity checks live in `src/test/e2e/AppSmoke.test.tsx`.
- **User-based evaluation checklist**: see `docs/testing-evaluation.md` for the structured pilot flow + reporting checklist.

## Deployment

Frontend is published via the project hosting workflow; Supabase provides the database, auth, and edge functions.

## Team

- **Lead / System build**: Jakub Majewski
- **Mentor**: Efe Bozkir
- **Team members (report/video/etc.)**: Zeynep Gurlek, Markus Moenckhoff, Michel Alexander, Manuel Peichl
