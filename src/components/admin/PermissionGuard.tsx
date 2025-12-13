import { ReactNode } from "react";
import { getPermissions, PermissionConfig } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, ShieldAlert } from "lucide-react";

interface PermissionGuardProps {
  userEmail: string;
  permission: keyof PermissionConfig;
  children: ReactNode;
  fallback?: ReactNode;
  showLockIcon?: boolean;
  tooltipText?: string;
}

/**
 * Component that guards content based on user permissions
 * If user doesn't have permission, shows fallback or locked state
 */
export const PermissionGuard = ({
  userEmail,
  permission,
  children,
  fallback,
  showLockIcon = true,
  tooltipText,
}: PermissionGuardProps) => {
  const permissions = getPermissions(userEmail);
  const hasPermission = permissions[permission];

  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showLockIcon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 text-slate-500 cursor-not-allowed opacity-50">
              <Lock className="w-4 h-4" />
              <span className="text-xs">Owner only</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-700 text-slate-100 border-slate-600 max-w-xs">
            <p className="text-sm">
              {tooltipText || "This action requires owner permissions. Contact jakub.majewski@tum.de for access."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
};

/**
 * Hook-like function to check permissions
 */
export const usePermissions = (userEmail: string) => {
  const permissions = getPermissions(userEmail);
  
  const can = (permission: keyof PermissionConfig): boolean => {
    return permissions[permission];
  };
  
  return { permissions, can };
};

/**
 * Visual badge showing permission level
 */
import { getPermissionLevel, OWNER_EMAIL, VIEWER_EMAILS } from "@/lib/permissions";
import { Eye } from "lucide-react";

export const PermissionBadge = ({ userEmail }: { userEmail: string }) => {
  const level = getPermissionLevel(userEmail);
  
  if (level === 'owner') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <ShieldAlert className="w-3.5 h-3.5" />
        Owner
      </div>
    );
  }
  
  if (level === 'viewer') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <Eye className="w-3.5 h-3.5" />
        Evaluator
      </div>
    );
  }
  
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
      <Lock className="w-3.5 h-3.5" />
      Admin
    </div>
  );
};
