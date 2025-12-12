import { supabase } from "@/integrations/supabase/client";

export type AuditActionType = 'create' | 'update' | 'delete';
export type AuditEntityType = 'slide' | 'question' | 'setting';

interface AuditLogParams {
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old?: any; new?: any } | any>;
}

export const logAdminAction = async ({
  actionType,
  entityType,
  entityId,
  entityName,
  changes,
}: AuditLogParams): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      console.warn('No authenticated user for audit log');
      return;
    }

    const { error } = await supabase
      .from('admin_audit_log')
      .insert({
        admin_email: session.user.email,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_name: entityName || null,
        changes: changes || null,
      });

    if (error) {
      console.error('Failed to log admin action:', error);
    }
  } catch (err) {
    console.error('Error in audit logging:', err);
  }
};

// Helper to compute changes between old and new objects
export const computeChanges = (
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldsToTrack: string[]
): Record<string, { old: any; new: any }> => {
  const changes: Record<string, { old: any; new: any }> = {};
  
  for (const field of fieldsToTrack) {
    const oldVal = oldData[field];
    const newVal = newData[field];
    
    // Check if values are different
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    
    if (oldStr !== newStr) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  
  return changes;
};
