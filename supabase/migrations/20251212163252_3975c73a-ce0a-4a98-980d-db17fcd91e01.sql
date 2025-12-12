-- Create audit log table to track all admin changes
CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'question', 'slide', 'setting'
  entity_id TEXT, -- ID of the changed entity
  entity_name TEXT, -- Human-readable name/title
  changes JSONB, -- Details of what changed (old/new values)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only owner can view audit logs
CREATE POLICY "Only owner can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'jakub.majewski@tum.de'
);

-- Researchers can insert audit logs (when they make changes)
CREATE POLICY "Researchers can insert audit logs"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_admin_email ON public.admin_audit_log(admin_email);