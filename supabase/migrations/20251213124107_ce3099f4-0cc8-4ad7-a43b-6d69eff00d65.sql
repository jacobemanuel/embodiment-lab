-- Add separate API settings for granular control
-- Insert separate settings for OpenAI and Anam APIs
INSERT INTO public.app_settings (key, value, updated_by)
VALUES 
  ('openai_api_enabled', '{"enabled": true}'::jsonb, 'system'),
  ('anam_api_enabled', '{"enabled": true}'::jsonb, 'system'),
  ('anam_api_key', '{"key": ""}'::jsonb, 'system')
ON CONFLICT (key) DO NOTHING;