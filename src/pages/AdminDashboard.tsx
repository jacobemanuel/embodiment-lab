import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, BarChart3, FileText, Settings, Users, Presentation, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminSessions from "@/components/admin/AdminSessions";
import AdminResponses from "@/components/admin/AdminResponses";
import AdminQuestions from "@/components/admin/AdminQuestions";
import AdminSlides from "@/components/admin/AdminSlides";
import ApiToggle from "@/components/admin/ApiToggle";

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

  const TabWithHelp = ({ value, icon: Icon, label, help }: { value: string; icon: any; label: string; help: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger value={value} className="data-[state=active]:bg-primary">
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
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-white">Research Panel</h1>
              <p className="text-sm text-slate-400">AI Image Generation Study</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{userEmail}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Owner-only API Toggle */}
        <ApiToggle userEmail={userEmail} />
        
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto gap-1 p-1">
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
            <TabWithHelp 
              value="slides" 
              icon={Presentation} 
              label="Slides" 
              help="Edit learning content. The 'AI Context' field tells the AI tutor what each slide is about."
            />
            <TabWithHelp 
              value="questions" 
              icon={Settings} 
              label="Questions" 
              help="Edit pre-test, post-test, and demographic survey questions. Changes go live immediately."
            />
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>

          <TabsContent value="sessions">
            <AdminSessions />
          </TabsContent>

          <TabsContent value="responses">
            <AdminResponses />
          </TabsContent>

          <TabsContent value="slides">
            <AdminSlides />
          </TabsContent>

          <TabsContent value="questions">
            <AdminQuestions />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
