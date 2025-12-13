-- Update the audit log policy to allow all researchers/admins to view
DROP POLICY IF EXISTS "Only owner can view audit logs" ON public.admin_audit_log;

CREATE POLICY "Researchers can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (has_role(auth.uid(), 'researcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));