-- Create flexible demographic_responses table (same pattern as pre_test_responses)
CREATE TABLE public.demographic_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demographic_responses ENABLE ROW LEVEL SECURITY;

-- Create policy for researchers to view
CREATE POLICY "Researchers can view all demographic responses"
ON public.demographic_responses
FOR SELECT
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_demographic_responses_session ON public.demographic_responses(session_id);
CREATE INDEX idx_demographic_responses_question ON public.demographic_responses(question_id);