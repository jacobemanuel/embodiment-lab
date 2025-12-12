-- Add RLS policies for admins/researchers to read all research data
CREATE POLICY "Researchers can view all study sessions"
ON public.study_sessions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can view all demographics"
ON public.demographics FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can view all pre test responses"
ON public.pre_test_responses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can view all post test responses"
ON public.post_test_responses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can view all scenarios"
ON public.scenarios FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can view all dialogue turns"
ON public.dialogue_turns FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create questions table for live editing
CREATE TABLE public.study_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_type TEXT NOT NULL CHECK (question_type IN ('pre_test', 'post_test', 'demographic')),
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT,
  category TEXT,
  question_meta JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  pending_changes JSONB,
  UNIQUE(question_type, question_id)
);

ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;

-- Only researchers/admins can view questions
CREATE POLICY "Anyone can view active questions"
ON public.study_questions FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Only researchers/admins can manage questions
CREATE POLICY "Researchers can manage questions"
ON public.study_questions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create question change requests table for approval workflow
CREATE TABLE public.question_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES public.study_questions(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  proposed_changes JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT
);

ALTER TABLE public.question_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Researchers can view change requests"
ON public.question_change_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can create change requests"
ON public.question_change_requests FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers can update change requests"
ON public.question_change_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_study_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_study_questions_timestamp
BEFORE UPDATE ON public.study_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_study_questions_updated_at();