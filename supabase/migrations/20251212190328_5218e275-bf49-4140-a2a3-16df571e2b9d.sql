-- Drop and recreate the view with proper security for public access
DROP VIEW IF EXISTS public.study_questions_public;

CREATE VIEW public.study_questions_public 
WITH (security_invoker = false)
AS
SELECT 
  id,
  question_id,
  question_type,
  question_text,
  options,
  question_meta,
  category,
  sort_order,
  is_active,
  CASE 
    WHEN correct_answer IS NOT NULL AND correct_answer LIKE '%|||%' THEN true
    ELSE false
  END as allow_multiple
FROM public.study_questions
WHERE is_active = true;

-- Grant SELECT access to the public view for all users (including anonymous)
GRANT SELECT ON public.study_questions_public TO anon, authenticated;