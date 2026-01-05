-- Store learning-mode tutor dialogues (text + avatar)
CREATE TABLE public.tutor_dialogue_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  mode public.study_mode NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ai', 'user')),
  content TEXT NOT NULL,
  slide_id TEXT,
  slide_title TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_dialogue_turns ENABLE ROW LEVEL SECURITY;

-- Researchers/Admins can view all tutor dialogue turns
CREATE POLICY "Researchers can view all tutor dialogue turns"
ON public.tutor_dialogue_turns
FOR SELECT
USING (
  has_role(auth.uid(), 'researcher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Performance indexes
CREATE INDEX idx_tutor_dialogue_turns_session_id ON public.tutor_dialogue_turns(session_id);
CREATE INDEX idx_tutor_dialogue_turns_timestamp ON public.tutor_dialogue_turns(timestamp);
CREATE INDEX idx_tutor_dialogue_turns_mode ON public.tutor_dialogue_turns(mode);