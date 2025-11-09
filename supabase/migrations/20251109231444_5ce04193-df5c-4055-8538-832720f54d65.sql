-- Enable RLS on all tables
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialogue_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_test_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for study_sessions
CREATE POLICY "Allow public insert for study sessions"
  ON public.study_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for study sessions"
  ON public.study_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public update for study sessions"
  ON public.study_sessions
  FOR UPDATE
  USING (true);

-- Create policies for demographics
CREATE POLICY "Allow public insert for demographics"
  ON public.demographics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for demographics"
  ON public.demographics
  FOR SELECT
  USING (true);

-- Create policies for pre_test_responses
CREATE POLICY "Allow public insert for pre_test_responses"
  ON public.pre_test_responses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for pre_test_responses"
  ON public.pre_test_responses
  FOR SELECT
  USING (true);

-- Create policies for scenarios
CREATE POLICY "Allow public insert for scenarios"
  ON public.scenarios
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for scenarios"
  ON public.scenarios
  FOR SELECT
  USING (true);

-- Create policies for dialogue_turns
CREATE POLICY "Allow public insert for dialogue_turns"
  ON public.dialogue_turns
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for dialogue_turns"
  ON public.dialogue_turns
  FOR SELECT
  USING (true);

-- Create policies for post_test_responses
CREATE POLICY "Allow public insert for post_test_responses"
  ON public.post_test_responses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for post_test_responses"
  ON public.post_test_responses
  FOR SELECT
  USING (true);