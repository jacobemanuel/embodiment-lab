-- Create app_settings table for owner-only settings
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY "Admins can view settings"
ON public.app_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'researcher'::app_role));

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
ON public.app_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'researcher'::app_role));

-- Insert default API enabled setting (disabled by default)
INSERT INTO public.app_settings (key, value, updated_by)
VALUES ('api_enabled', '{"enabled": false}'::jsonb, 'system');