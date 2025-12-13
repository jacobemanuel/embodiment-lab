-- Add validation_status column to study_sessions for admin control over suspicious sessions
-- Status values: 'pending' (default), 'accepted' (included in stats), 'ignored' (excluded from stats)
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending';

-- Add validated_by to track who made the decision
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS validated_by text NULL;

-- Add validated_at timestamp
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_study_sessions_validation_status ON public.study_sessions(validation_status);