import { describe, it, expect } from 'vitest';
import { getPermissions, getPermissionLevel, OWNER_EMAIL, VIEWER_EMAILS } from '../permissions';

describe('permissions', () => {
  describe('OWNER_EMAIL', () => {
    it('is defined and is a valid email', () => {
      expect(OWNER_EMAIL).toBeDefined();
      expect(OWNER_EMAIL).toMatch(/@/);
    });
  });

  describe('VIEWER_EMAILS', () => {
    it('is defined and contains mentor emails', () => {
      expect(VIEWER_EMAILS).toBeDefined();
      expect(Array.isArray(VIEWER_EMAILS)).toBe(true);
    });
  });

  describe('getPermissionLevel', () => {
    it('returns owner for owner email', () => {
      expect(getPermissionLevel(OWNER_EMAIL)).toBe('owner');
    });

    it('returns viewer for mentor email', () => {
      expect(getPermissionLevel('efe.bozkir@tum.de')).toBe('viewer');
    });

    it('returns admin for other emails', () => {
      expect(getPermissionLevel('admin@example.com')).toBe('admin');
    });
  });

  describe('getPermissions', () => {
    it('returns full permissions for owner', () => {
      const permissions = getPermissions(OWNER_EMAIL);

      expect(permissions.canEditSlides).toBe(true);
      expect(permissions.canDeleteSlides).toBe(true);
      expect(permissions.canViewAuditLog).toBe(true);
      expect(permissions.canToggleApis).toBe(true);
      expect(permissions.canEditApiKeys).toBe(true);
      expect(permissions.canDeleteSessions).toBe(true);
      expect(permissions.canResetData).toBe(true);
      expect(permissions.canViewApiSettings).toBe(true);
    });

    it('returns read-only permissions for viewer/mentor', () => {
      const permissions = getPermissions('efe.bozkir@tum.de');

      // Can view research data
      expect(permissions.canViewSessions).toBe(true);
      expect(permissions.canExportData).toBe(true);
      expect(permissions.canViewSlides).toBe(true);
      expect(permissions.canViewQuestions).toBe(true);

      // Cannot edit anything
      expect(permissions.canEditSlides).toBe(false);
      expect(permissions.canEditQuestions).toBe(false);
      expect(permissions.canCreateSlides).toBe(false);
      expect(permissions.canToggleApis).toBe(false);

      // Cannot see sensitive tabs
      expect(permissions.canViewApiSettings).toBe(false);
      expect(permissions.canViewAuditLog).toBe(false);
      expect(permissions.canViewPermissionsTab).toBe(false);
    });

    it('returns limited permissions for admin', () => {
      const permissions = getPermissions('admin@example.com');

      expect(permissions.canEditSlides).toBe(true);
      expect(permissions.canDeleteSlides).toBe(false);
      expect(permissions.canViewAuditLog).toBe(true);
      expect(permissions.canToggleApis).toBe(true);
      expect(permissions.canEditApiKeys).toBe(true);
      expect(permissions.canDeleteSessions).toBe(false);
      expect(permissions.canResetData).toBe(false);
    });

    it('prevents admins from deleting content', () => {
      const permissions = getPermissions('admin@example.com');

      expect(permissions.canDeleteSlides).toBe(false);
      expect(permissions.canDeleteQuestions).toBe(false);
      expect(permissions.canDeleteSessions).toBe(false);
    });

    it('allows admins to edit content', () => {
      const permissions = getPermissions('admin@example.com');

      expect(permissions.canEditSlides).toBe(true);
      expect(permissions.canEditQuestions).toBe(true);
      expect(permissions.canCreateSlides).toBe(true);
      expect(permissions.canCreateQuestions).toBe(true);
    });
  });
});
