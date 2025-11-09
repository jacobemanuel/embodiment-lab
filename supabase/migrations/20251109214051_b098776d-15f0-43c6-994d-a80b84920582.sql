-- Remove all unrestricted INSERT policies to prevent spam and fake data
DROP POLICY IF EXISTS "Anyone can insert study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Anyone can insert demographics" ON public.demographics;
DROP POLICY IF EXISTS "Anyone can insert pre_test responses" ON public.pre_test_responses;
DROP POLICY IF EXISTS "Anyone can insert scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "Anyone can insert dialogue turns" ON public.dialogue_turns;
DROP POLICY IF EXISTS "Anyone can insert post_test responses" ON public.post_test_responses;

-- All data insertion will now go through validated edge functions
-- This prevents bots, spam, and malicious data from corrupting research results