import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, BarChart3, FileText, Settings, Users, Presentation, Clock, Cog, Shield, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminSessions from "@/components/admin/AdminSessions";
import AdminResponses from "@/components/admin/AdminResponses";
import AdminQuestions from "@/components/admin/AdminQuestions";
import AdminSlides from "@/components/admin/AdminSlides";
import AdminAuditLog from "@/components/admin/AdminAuditLog";
import ApiToggle from "@/components/admin/ApiToggle";
import PermissionsInfo from "@/components/admin/PermissionsInfo";
import { PermissionBadge } from "@/components/admin/PermissionGuard";
import { getPermissions, OWNER_EMAIL } from "@/lib/permissions";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/admin/login');
        return;
      }

      // Check if user has researcher role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      if (rolesError || !roles || roles.length === 0) {
        await supabase.auth.signOut();
        navigate('/admin/login');
        toast.error("No access to admin panel");
        return;
      }

      setUserEmail(session.user.email || "");
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/admin/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const permissions = getPermissions(userEmail);

  const TabWithHelp = ({ value, icon: Icon, label, help }: { value: string; icon: any; label: string; help: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger 
            value={value} 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:font-semibold transition-all duration-200"
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-700 text-slate-100 border-slate-600">
          <p className="text-sm">{help}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white">Research Panel</h1>
              <p className="text-xs md:text-sm text-slate-400 hidden sm:block">AI Image Generation Study</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <PermissionBadge userEmail={userEmail} />
              <span className="text-xs md:text-sm text-slate-400 truncate max-w-[120px] md:max-w-none">{userEmail}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
            <TabsList className="bg-slate-800 border border-slate-700 flex-nowrap md:flex-wrap h-auto gap-1 md:gap-1.5 p-1 md:p-1.5 rounded-xl min-w-max md:min-w-0">
              <TabWithHelp 
                value="overview" 
                icon={BarChart3} 
                label="Overview" 
                help="Dashboard with key statistics: total sessions, completion rates, and trends over time."
              />
              <TabWithHelp 
                value="sessions" 
                icon={Users} 
                label="Sessions" 
                help="View all participant sessions. See who completed the study, their mode, and duration."
              />
              <TabWithHelp 
                value="responses" 
                icon={FileText} 
                label="Responses" 
                help="View and export all participant responses to pre-test, post-test, and demographic questions."
              />
              {permissions.canViewSlides && (
                <TabWithHelp 
                  value="slides" 
                  icon={Presentation} 
                  label="Slides" 
                  help="Edit learning content. The 'AI Context' field tells the AI tutor what each slide is about."
                />
              )}
              {permissions.canViewQuestions && (
                <TabWithHelp 
                  value="questions" 
                  icon={Settings} 
                  label="Questions" 
                  help="Edit pre-test, post-test, and demographic survey questions. Changes go live immediately."
                />
              )}
              {permissions.canViewApiSettings && (
                <TabWithHelp 
                  value="settings" 
                  icon={Cog} 
                  label="API Settings" 
                  help="Control API toggles (OpenAI, Anam) and manage API keys for the study."
                />
              )}
              {permissions.canViewPermissionsTab && (
                <TabWithHelp 
                  value="permissions" 
                  icon={Shield} 
                  label="My Access" 
                  help="View your permissions and what you can do in the admin panel."
                />
              )}
              {permissions.canViewAuditLog && (
                <TabWithHelp 
                  value="audit" 
                  icon={Clock} 
                  label="Activity Log" 
                  help="View all changes made by admins. Track who changed what and when."
                />
              )}
            </TabsList>
          </div>

          <TabsContent value="overview">
            <AdminOverview userEmail={userEmail} />
          </TabsContent>

          <TabsContent value="sessions">
            <AdminSessions userEmail={userEmail} />
          </TabsContent>

          <TabsContent value="responses">
            <AdminResponses userEmail={userEmail} />
          </TabsContent>

          {permissions.canViewSlides && (
            <TabsContent value="slides">
              <AdminSlides userEmail={userEmail} />
            </TabsContent>
          )}

          {permissions.canViewQuestions && (
            <TabsContent value="questions">
              <AdminQuestions userEmail={userEmail} />
            </TabsContent>
          )}

          {permissions.canViewApiSettings && (
            <TabsContent value="settings">
              <ApiToggle userEmail={userEmail} />
            </TabsContent>
          )}

          {permissions.canViewPermissionsTab && (
            <TabsContent value="permissions">
              <PermissionsInfo userEmail={userEmail} />
            </TabsContent>
          )}

          {permissions.canViewAuditLog && (
            <TabsContent value="audit">
              <AdminAuditLog />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-8 md:mt-12 border-t border-slate-700 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col items-center text-center gap-2 md:gap-3">
            <h2 className="text-base md:text-lg font-semibold text-slate-200">
              P6: AI Study Buddy
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl px-4">
              Exploring Trust and Engagement toward Embodied AI Agents for AI Literacy
            </p>
            <p className="text-xs text-slate-500">
              Mentor: Efe Bozkir
            </p>
          </div>
          
          <div className="mt-4 md:mt-6 pt-4 border-t border-slate-700/50 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-xs text-slate-500">
            <span>Technical University of Munich</span>
            <span className="hidden md:inline">•</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <span className="hidden md:inline">•</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
