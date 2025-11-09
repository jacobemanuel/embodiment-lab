-- Remove the UPDATE policy entirely to prevent any client-side modifications
DROP POLICY IF EXISTS "Can only mark session as completed once" ON public.study_sessions;

-- For anonymous research studies, all data modifications should go through edge functions
-- This prevents any malicious client-side data corruption