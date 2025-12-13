// Centralized permission system for admin panel
// Owner has full control, Admins have content editing with safety restrictions

export const OWNER_EMAIL = "jakub.majewski@tum.de";

export type PermissionLevel = 'owner' | 'admin' | 'viewer';

export interface PermissionConfig {
  // Content Management
  canEditSlides: boolean;
  canDeleteSlides: boolean;
  canCreateSlides: boolean;
  canHideSlides: boolean;
  
  canEditQuestions: boolean;
  canDeleteQuestions: boolean;
  canCreateQuestions: boolean;
  canDisableQuestions: boolean;
  canMarkCorrectAnswers: boolean;
  
  // API & Settings
  canViewApiSettings: boolean;
  canToggleApis: boolean;
  canEditApiKeys: boolean;
  
  // Data & Analytics
  canViewSessions: boolean;
  canExportData: boolean;
  canViewAuditLog: boolean;
  
  // Dangerous Operations
  canDeleteSessions: boolean;
  canResetData: boolean;
}

export const getPermissionLevel = (email: string): PermissionLevel => {
  if (email === OWNER_EMAIL) return 'owner';
  return 'admin'; // All authenticated admin_users are admins
};

export const getPermissions = (email: string): PermissionConfig => {
  const level = getPermissionLevel(email);
  
  if (level === 'owner') {
    return {
      // Full control for owner
      canEditSlides: true,
      canDeleteSlides: true,
      canCreateSlides: true,
      canHideSlides: true,
      
      canEditQuestions: true,
      canDeleteQuestions: true,
      canCreateQuestions: true,
      canDisableQuestions: true,
      canMarkCorrectAnswers: true,
      
      canViewApiSettings: true,
      canToggleApis: true,
      canEditApiKeys: true,
      
      canViewSessions: true,
      canExportData: true,
      canViewAuditLog: true,
      
      canDeleteSessions: true,
      canResetData: true,
    };
  }
  
  // Admin permissions - can edit content but with safety restrictions
  return {
    canEditSlides: true,
    canDeleteSlides: false, // SAFETY: Can't delete slides
    canCreateSlides: true,
    canHideSlides: true, // Can hide but not delete
    
    canEditQuestions: true,
    canDeleteQuestions: false, // SAFETY: Can't delete questions
    canCreateQuestions: true,
    canDisableQuestions: true, // Can disable but not delete
    canMarkCorrectAnswers: true,
    
    canViewApiSettings: true,
    canToggleApis: true, // Can toggle Anam API
    canEditApiKeys: true, // Can update Anam API key (for free tier swapping)
    
    canViewSessions: true,
    canExportData: true,
    canViewAuditLog: true, // Admins can now see audit log too
    
    canDeleteSessions: false, // SAFETY: Can't delete research data
    canResetData: false, // SAFETY: Can't reset data
  };
};

// Permission descriptions for UI
export const PERMISSION_DESCRIPTIONS: Record<keyof PermissionConfig, { label: string; description: string; level: 'safe' | 'caution' | 'danger' }> = {
  canEditSlides: {
    label: 'Edit Slides',
    description: 'Modify slide content, key points, and AI context',
    level: 'safe',
  },
  canDeleteSlides: {
    label: 'Delete Slides',
    description: 'Permanently remove slides from the study',
    level: 'danger',
  },
  canCreateSlides: {
    label: 'Create Slides',
    description: 'Add new slides to the learning content',
    level: 'safe',
  },
  canHideSlides: {
    label: 'Hide/Show Slides',
    description: 'Toggle slide visibility without deleting',
    level: 'caution',
  },
  canEditQuestions: {
    label: 'Edit Questions',
    description: 'Modify question text and answer options',
    level: 'safe',
  },
  canDeleteQuestions: {
    label: 'Delete Questions',
    description: 'Permanently remove questions from surveys',
    level: 'danger',
  },
  canCreateQuestions: {
    label: 'Create Questions',
    description: 'Add new questions to surveys',
    level: 'safe',
  },
  canDisableQuestions: {
    label: 'Disable Questions',
    description: 'Temporarily disable questions without deleting',
    level: 'caution',
  },
  canMarkCorrectAnswers: {
    label: 'Mark Correct Answers',
    description: 'Set which answers are correct for scoring',
    level: 'safe',
  },
  canViewApiSettings: {
    label: 'View API Settings',
    description: 'See API status and configuration',
    level: 'safe',
  },
  canToggleApis: {
    label: 'Toggle APIs',
    description: 'Enable/disable OpenAI and Anam APIs',
    level: 'caution',
  },
  canEditApiKeys: {
    label: 'Edit API Keys',
    description: 'Update Anam API key for free tier rotation',
    level: 'caution',
  },
  canViewSessions: {
    label: 'View Sessions',
    description: 'See all participant sessions and data',
    level: 'safe',
  },
  canExportData: {
    label: 'Export Data',
    description: 'Download CSV/PDF reports of research data',
    level: 'safe',
  },
  canViewAuditLog: {
    label: 'View Audit Log',
    description: 'See all admin actions and changes',
    level: 'safe',
  },
  canDeleteSessions: {
    label: 'Delete Sessions',
    description: 'Permanently remove participant data',
    level: 'danger',
  },
  canResetData: {
    label: 'Reset Data',
    description: 'Clear all research data',
    level: 'danger',
  },
};
