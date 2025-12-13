import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Mail, Shield } from "lucide-react";
import logo from "@/assets/logo-white.png";
import adminBg1 from "@/assets/admin-bg.jpg";
import adminBg2 from "@/assets/admin-bg-2.jpg";
import adminBg3 from "@/assets/admin-bg-3.jpg";
import adminBg4 from "@/assets/admin-bg-4.png";
import adminBg5 from "@/assets/admin-bg-5.jpg";
import adminBg6 from "@/assets/admin-bg-6.png";

const adminBackgrounds = [adminBg1, adminBg2, adminBg3, adminBg4, adminBg5, adminBg6];

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Pick random background once on mount
  const randomBg = useMemo(() => adminBackgrounds[Math.floor(Math.random() * adminBackgrounds.length)], []);

  useEffect(() => {
    // Check if already logged in as researcher
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has researcher role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        if (roles && roles.length > 0) {
          navigate('/admin');
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error("Login error: " + error.message);
        return;
      }

      if (data.user) {
        // Check if user has researcher role
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);

        if (rolesError || !roles || roles.length === 0) {
          await supabase.auth.signOut();
          toast.error("No access to admin panel");
          return;
        }

        toast.success("Logged in successfully!");
        navigate('/admin');
      }
    } catch (error) {
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Background image with blur to hide low resolution */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat scale-110 blur-sm"
        style={{ backgroundImage: `url(${randomBg})` }}
      />
      {/* Gradient overlay for style */}
      <div className="fixed inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />
      
      {/* TUM Logo */}
      <div className="fixed top-6 left-6 z-20">
        <img src={logo} alt="TUM Logo" className="h-8" />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-white">Research Panel</CardTitle>
          <CardDescription className="text-slate-400">
            Access restricted to authorized team members only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;