-- Create enum for study modes
CREATE TYPE public.study_mode AS ENUM ('text', 'voice', 'avatar');

-- Create study_sessions table
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  mode study_mode NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create demographics table
CREATE TABLE public.demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  age_range TEXT,
  education TEXT,
  ai_experience TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pre_test_responses table
CREATE TABLE public.pre_test_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scenarios table
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  scenario_id TEXT NOT NULL,
  confidence_rating INTEGER NOT NULL CHECK (confidence_rating >= 1 AND confidence_rating <= 10),
  trust_rating INTEGER NOT NULL CHECK (trust_rating >= 1 AND trust_rating <= 10),
  engagement_rating BOOLEAN NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create dialogue_turns table
CREATE TABLE public.dialogue_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ai', 'user')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create post_test_responses table
CREATE TABLE public.post_test_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialogue_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_test_responses ENABLE ROW LEVEL SECURITY;

-- Create public access policies (no authentication required for research study)
CREATE POLICY "Anyone can insert study sessions"
ON public.study_sessions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can update their own sessions"
ON public.study_sessions FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Anyone can view study sessions"
ON public.study_sessions FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anyone can insert demographics"
ON public.demographics FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can insert pre_test responses"
ON public.pre_test_responses FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can insert scenarios"
ON public.scenarios FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can insert dialogue turns"
ON public.dialogue_turns FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can insert post_test responses"
ON public.post_test_responses FOR INSERT
TO anon
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_study_sessions_session_id ON public.study_sessions(session_id);
CREATE INDEX idx_demographics_session_id ON public.demographics(session_id);
CREATE INDEX idx_pre_test_session_id ON public.pre_test_responses(session_id);
CREATE INDEX idx_scenarios_session_id ON public.scenarios(session_id);
CREATE INDEX idx_dialogue_turns_scenario_id ON public.dialogue_turns(scenario_id);
CREATE INDEX idx_post_test_session_id ON public.post_test_responses(session_id);