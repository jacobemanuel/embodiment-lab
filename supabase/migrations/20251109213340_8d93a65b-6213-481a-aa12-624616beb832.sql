-- Drop the insecure UPDATE policy that allows anyone to modify any session
DROP POLICY IF EXISTS "Anyone can update their own sessions" ON public.study_sessions;

-- Create a more restrictive UPDATE policy that only allows setting completed_at once
-- This prevents malicious actors from modifying session data after completion
CREATE POLICY "Can only mark session as completed once" 
ON public.study_sessions 
FOR UPDATE 
USING (completed_at IS NULL)
WITH CHECK (completed_at IS NOT NULL);