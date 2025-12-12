-- Drop and recreate the view with SECURITY INVOKER (default, but explicit for clarity)
DROP VIEW IF EXISTS public.study_questions_public;

CREATE VIEW public.study_questions_public 
WITH (security_invoker = true) AS
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
  CASE WHEN correct_answer LIKE '%|||%' THEN true ELSE false END as allow_multiple
FROM public.study_questions
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.study_questions_public TO anon, authenticated;