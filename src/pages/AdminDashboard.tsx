import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, BarChart3, FileText, Settings, Users, Clock, Download } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminSessions from "@/components/admin/AdminSessions";
import AdminResponses from "@/components/admin/AdminResponses";
import AdminQuestions from "@/components/admin/AdminQuestions";

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
        toast.error("Brak uprawnień do panelu administracyjnego");
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

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-white">Panel Badawczy</h1>
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
              Wyloguj
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary">
              <BarChart3 className="w-4 h-4 mr-2" />
              Przegląd
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-primary">
              <Users className="w-4 h-4 mr-2" />
              Sesje
            </TabsTrigger>
            <TabsTrigger value="responses" className="data-[state=active]:bg-primary">
              <FileText className="w-4 h-4 mr-2" />
              Odpowiedzi
            </TabsTrigger>
            <TabsTrigger value="questions" className="data-[state=active]:bg-primary">
              <Settings className="w-4 h-4 mr-2" />
              Pytania
            </TabsTrigger>
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

          <TabsContent value="questions">
            <AdminQuestions />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
