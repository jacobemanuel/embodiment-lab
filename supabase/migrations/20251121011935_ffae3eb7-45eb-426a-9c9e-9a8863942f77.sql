-- Fix PUBLIC_DATA_EXPOSURE: Remove all public SELECT policies
-- This prevents anyone from reading research data directly from the database
DROP POLICY IF EXISTS "Allow public select for study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Allow public select for demographics" ON demographics;
DROP POLICY IF EXISTS "Allow public select for pre_test_responses" ON pre_test_responses;
DROP POLICY IF EXISTS "Allow public select for post_test_responses" ON post_test_responses;
DROP POLICY IF EXISTS "Allow public select for dialogue_turns" ON dialogue_turns;
DROP POLICY IF EXISTS "Allow public select for scenarios" ON scenarios;

-- Fix MISSING_RLS: Remove all public INSERT/UPDATE/DELETE policies
-- This prevents anyone from modifying research data directly
DROP POLICY IF EXISTS "Allow public insert for study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Allow public update for study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Allow public insert for demographics" ON demographics;
DROP POLICY IF EXISTS "Allow public insert for pre_test_responses" ON pre_test_responses;
DROP POLICY IF EXISTS "Allow public insert for post_test_responses" ON post_test_responses;
DROP POLICY IF EXISTS "Allow public insert for dialogue_turns" ON dialogue_turns;
DROP POLICY IF EXISTS "Allow public insert for scenarios" ON scenarios;

-- Note: RLS remains enabled on all tables
-- Edge functions will continue to work using service role keys
-- Your application functionality is unaffected