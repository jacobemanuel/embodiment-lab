-- Create slides table for live editing
CREATE TABLE public.study_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  key_points JSONB NOT NULL DEFAULT '[]',
  system_prompt_context TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_slides ENABLE ROW LEVEL SECURITY;

-- Anyone can view active slides for the learning experience
CREATE POLICY "Anyone can view active slides"
ON public.study_slides FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Only researchers/admins can manage slides
CREATE POLICY "Researchers can manage slides"
ON public.study_slides FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger for slides
CREATE TRIGGER update_study_slides_timestamp
BEFORE UPDATE ON public.study_slides
FOR EACH ROW
EXECUTE FUNCTION public.update_study_questions_updated_at();