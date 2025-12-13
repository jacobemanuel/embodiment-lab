import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getPermissions, PERMISSION_DESCRIPTIONS, PermissionConfig, OWNER_EMAIL } from "@/lib/permissions";
import { CheckCircle2, XCircle, AlertTriangle, Shield, Lock, Info } from "lucide-react";

interface PermissionsInfoProps {
  userEmail: string;
}

const PermissionsInfo = ({ userEmail }: PermissionsInfoProps) => {
  const permissions = getPermissions(userEmail);
  const isOwner = userEmail === OWNER_EMAIL;

  const permissionGroups = {
    "Content Management": [
      'canEditSlides', 'canCreateSlides', 'canHideSlides', 'canDeleteSlides',
      'canEditQuestions', 'canCreateQuestions', 'canDisableQuestions', 'canDeleteQuestions',
      'canMarkCorrectAnswers'
    ],
    "API & Settings": ['canViewApiSettings', 'canToggleApis', 'canEditApiKeys'],
    "Data & Analytics": ['canViewSessions', 'canExportData', 'canViewAuditLog'],
    "Dangerous Operations": ['canDeleteSessions', 'canResetData'],
  };

  const getLevelIcon = (level: 'safe' | 'caution' | 'danger') => {
    switch (level) {
      case 'safe':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'caution':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'danger':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getLevelBadge = (level: 'safe' | 'caution' | 'danger') => {
    switch (level) {
      case 'safe':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Safe</Badge>;
      case 'caution':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Caution</Badge>;
      case 'danger':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Danger</Badge>;
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="text-white">Your Permissions</CardTitle>
              <CardDescription>
                {isOwner 
                  ? "You have full owner access to all features" 
                  : "You have admin access with some restrictions for safety"}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={isOwner 
              ? "border-amber-500 text-amber-300 bg-amber-500/10" 
              : "border-blue-500 text-blue-300 bg-blue-500/10"
            }
          >
            {isOwner ? "👑 Owner" : "🔐 Admin"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOwner && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">Admin Safety Features</p>
              <p className="text-blue-300/80">
                As an admin, you can freely edit content (slides, questions) and manage APIs. 
                However, you cannot <strong>delete</strong> slides or questions to prevent accidental data loss.
                You can <strong>hide</strong> or <strong>disable</strong> them instead.
              </p>
            </div>
          </div>
        )}

        <Accordion type="single" collapsible className="space-y-2">
          {Object.entries(permissionGroups).map(([groupName, permissionKeys]) => (
            <AccordionItem 
              key={groupName} 
              value={groupName}
              className="border border-slate-700 rounded-lg px-4"
            >
              <AccordionTrigger className="text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <span>{groupName}</span>
                  <Badge variant="outline" className="text-xs">
                    {permissionKeys.filter(k => permissions[k as keyof PermissionConfig]).length}/{permissionKeys.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {permissionKeys.map((key) => {
                    const permKey = key as keyof PermissionConfig;
                    const desc = PERMISSION_DESCRIPTIONS[permKey];
                    const hasPermission = permissions[permKey];
                    
                    return (
                      <div 
                        key={key} 
                        className={`flex items-center justify-between p-2 rounded ${
                          hasPermission ? 'bg-slate-700/50' : 'bg-slate-900/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {hasPermission ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-500" />
                          )}
                          <div>
                            <p className="text-sm text-white">{desc.label}</p>
                            <p className="text-xs text-slate-400">{desc.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getLevelBadge(desc.level)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            Logged in as: <span className="text-slate-300">{userEmail}</span>
            {isOwner && <span className="ml-2 text-amber-400">(Owner)</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PermissionsInfo;
