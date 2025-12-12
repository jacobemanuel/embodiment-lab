-- Create a view for public question access that excludes correct_answer
CREATE OR REPLACE VIEW public.study_questions_public AS
SELECT 
  id,
  question_type,
  question_id,
  question_text,
  options,
  question_meta,
  category,
  sort_order,
  is_active,
  -- Include a hint about whether multiple answers are allowed, without revealing the answers
  CASE WHEN correct_answer LIKE '%|||%' THEN true ELSE false END as allow_multiple
FROM public.study_questions
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.study_questions_public TO anon, authenticated;

-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "Anyone can view active questions" ON public.study_questions;

-- Create a new policy that only allows researchers to see the full table (including correct_answer)
CREATE POLICY "Only researchers can view all questions"
ON public.study_questions
FOR SELECT
USING (
  has_role(auth.uid(), 'researcher'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);