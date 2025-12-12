import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, ZapOff, Shield, Loader2 } from "lucide-react";

interface ApiToggleProps {
  userEmail: string;
}

const OWNER_EMAIL = 'jakub.majewski@tum.de';

const ApiToggle = ({ userEmail }: ApiToggleProps) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Only show for owner
  if (userEmail !== OWNER_EMAIL) {
    return null;
  }

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('toggle-api', {
          body: { action: 'get' }
        });

        if (error) throw error;
        setIsEnabled(data.enabled);
      } catch (error) {
        console.error('Error fetching API status:', error);
        toast.error('Failed to fetch API status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('toggle-api', {
        body: { action: 'toggle' }
      });

      if (error) throw error;

      setIsEnabled(data.enabled);
      toast.success(data.message);
    } catch (error) {
      console.error('Error toggling API:', error);
      toast.error('Failed to toggle API status');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-500" />
          <CardTitle className="text-white text-lg">API Control</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          Owner-only: Enable or disable AI services (Chat & Avatar)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading status...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <div className="flex items-center gap-2 text-green-400">
                  <Zap className="w-5 h-5" />
                  <span className="font-medium">API Enabled</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <ZapOff className="w-5 h-5" />
                  <span className="font-medium">API Disabled</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="api-toggle" className="text-slate-300 text-sm">
                {isToggling ? 'Switching...' : isEnabled ? 'ON' : 'OFF'}
              </Label>
              <Switch
                id="api-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          When disabled, participants will see "Service temporarily unavailable" message.
        </p>
      </CardContent>
    </Card>
  );
};

export default ApiToggle;
