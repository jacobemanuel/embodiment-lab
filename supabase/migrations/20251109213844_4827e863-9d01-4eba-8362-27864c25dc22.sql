-- Remove public SELECT access to protect research participant data
-- Only administrators/researchers can view data through Supabase dashboard
DROP POLICY IF EXISTS "Anyone can view study sessions" ON public.study_sessions;

-- Note: Data can still be inserted by participants (existing INSERT policy remains)
-- Researchers can view data through authenticated Supabase dashboard access