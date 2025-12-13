-- Add status column to track session validity
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON public.study_sessions(status);

-- Comment explaining status values
COMMENT ON COLUMN public.study_sessions.status IS 'Session status: active, completed, reset (invalid due to mode switch attempt), abandoned';

-- Add session_fingerprint for basic duplicate detection
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS browser_fingerprint text;

-- Add last_activity timestamp for timeout detection
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();

-- Create index for last activity (useful for cleanup)
CREATE INDEX IF NOT EXISTS idx_study_sessions_last_activity ON public.study_sessions(last_activity_at);