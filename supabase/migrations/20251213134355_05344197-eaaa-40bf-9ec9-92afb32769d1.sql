-- Create table for tracking avatar interaction time per slide
CREATE TABLE public.avatar_time_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  slide_id TEXT NOT NULL,
  slide_title TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatar_time_tracking ENABLE ROW LEVEL SECURITY;

-- Researchers can view all time tracking data
CREATE POLICY "Researchers can view avatar time tracking" 
ON public.avatar_time_tracking 
FOR SELECT 
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_avatar_time_tracking_session_id ON public.avatar_time_tracking(session_id);
CREATE INDEX idx_avatar_time_tracking_slide_id ON public.avatar_time_tracking(slide_id);