import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, ZapOff, Shield, Loader2, Key, Save, Eye, EyeOff, Power } from "lucide-react";

interface ApiToggleProps {
  userEmail: string;
}

const OWNER_EMAIL = 'jakub.majewski@tum.de';

interface ApiSettings {
  api_enabled?: { enabled: boolean; updated_at?: string; updated_by?: string };
  openai_api_enabled?: { enabled: boolean; updated_at?: string; updated_by?: string };
  anam_api_enabled?: { enabled: boolean; updated_at?: string; updated_by?: string };
  anam_api_key?: { key: string; updated_at?: string; updated_by?: string };
}

const ApiToggle = ({ userEmail }: ApiToggleProps) => {
  const [settings, setSettings] = useState<ApiSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('toggle-api', {
          body: { action: 'get' }
        });

        if (error) throw error;
        setSettings(data.settings || {});
        setIsOwner(data.isOwner || false);
      } catch (error) {
        console.error('Error fetching API status:', error);
        toast.error('Failed to fetch API status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const handleToggle = async (apiType: 'master' | 'openai' | 'anam') => {
    setIsToggling(apiType);
    try {
      const { data, error } = await supabase.functions.invoke('toggle-api', {
        body: { action: 'toggle', apiType }
      });

      if (error) throw error;

      // Update local state
      const settingKey = apiType === 'master' ? 'api_enabled' : `${apiType}_api_enabled`;
      setSettings(prev => ({
        ...prev,
        [settingKey]: { 
          ...prev[settingKey as keyof ApiSettings], 
          enabled: data.enabled,
          updated_by: userEmail,
          updated_at: new Date().toISOString()
        }
      }));
      
      toast.success(data.message);
    } catch (error) {
      console.error('Error toggling API:', error);
      toast.error('Failed to toggle API status');
    } finally {
      setIsToggling(null);
    }
  };

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsSavingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('toggle-api', {
        body: { action: 'update_key', newApiKey: newApiKey.trim() }
      });

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        anam_api_key: { 
          key: `***${newApiKey.slice(-4)}`,
          updated_by: userEmail,
          updated_at: new Date().toISOString()
        }
      }));
      
      setNewApiKey('');
      toast.success(data.message);
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const masterEnabled = settings.api_enabled?.enabled ?? false;
  const openaiEnabled = settings.openai_api_enabled?.enabled ?? false;
  const anamEnabled = settings.anam_api_enabled?.enabled ?? false;
  const currentAnamKey = settings.anam_api_key?.key || 'Not set';

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading API controls...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // For admins: show if Anam API is actually usable (master enabled + anam enabled + key set)
  const anamUsable = masterEnabled && anamEnabled && currentAnamKey !== 'Not set';

  return (
    <div className="space-y-4">
      {/* Status Banner for Admins */}
      {!isOwner && (
        <Card className={`border-2 ${anamUsable ? 'bg-green-900/20 border-green-600' : 'bg-red-900/20 border-red-600'}`}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {anamUsable ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-green-200 font-medium">Avatar API is Active</p>
                    <p className="text-green-300/70 text-sm">
                      Current key: {currentAnamKey} (added by {settings.anam_api_key?.updated_by || 'unknown'})
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div>
                    <p className="text-red-200 font-medium">Avatar API is Inactive</p>
                    <p className="text-red-300/70 text-sm">
                      {!masterEnabled ? 'Master switch is OFF (owner must enable)' : 
                       !anamEnabled ? 'Anam API is disabled - enable below or add your API key' :
                       'No API key set - add your Anam API key below'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Master Switch - Owner Only */}
      {isOwner && (
        <Card className="bg-slate-800 border-red-700/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5 text-red-500" />
              <CardTitle className="text-white text-lg">Master Switch</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Owner-only: Kill switch for ALL API services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {masterEnabled ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Zap className="w-5 h-5" />
                    <span className="font-medium">All APIs Enabled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <ZapOff className="w-5 h-5" />
                    <span className="font-medium">All APIs Disabled</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="master-toggle" className="text-slate-300 text-sm">
                  {isToggling === 'master' ? 'Switching...' : masterEnabled ? 'ON' : 'OFF'}
                </Label>
                <Switch
                  id="master-toggle"
                  checked={masterEnabled}
                  onCheckedChange={() => handleToggle('master')}
                  disabled={isToggling !== null}
                  className="data-[state=checked]:bg-red-600"
                />
              </div>
            </div>
            {settings.api_enabled?.updated_by && (
              <p className="text-xs text-slate-500 mt-2">
                Last changed by: {settings.api_enabled.updated_by}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* OpenAI API Toggle - Owner Only */}
      {isOwner && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-white text-lg">OpenAI API (Text Mode)</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Controls text-based chat functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {openaiEnabled ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Zap className="w-5 h-5" />
                    <span className="font-medium">Enabled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <ZapOff className="w-5 h-5" />
                    <span className="font-medium">Disabled</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="openai-toggle" className="text-slate-300 text-sm">
                  {isToggling === 'openai' ? 'Switching...' : openaiEnabled ? 'ON' : 'OFF'}
                </Label>
                <Switch
                  id="openai-toggle"
                  checked={openaiEnabled}
                  onCheckedChange={() => handleToggle('openai')}
                  disabled={isToggling !== null}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
            {settings.openai_api_enabled?.updated_by && (
              <p className="text-xs text-slate-500 mt-2">
                Last changed by: {settings.openai_api_enabled.updated_by}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Anam API Toggle - Available to all admins */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-white text-lg">Anam API (Avatar Mode)</CardTitle>
            {/* Status indicator */}
            <div className={`ml-auto flex items-center gap-2 px-2 py-1 rounded-full text-xs ${anamUsable ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              <div className={`w-2 h-2 rounded-full ${anamUsable ? 'bg-green-400' : 'bg-red-400'}`} />
              {anamUsable ? 'Active' : 'Inactive'}
            </div>
          </div>
          <CardDescription className="text-slate-400">
            Controls avatar-based interaction functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {anamEnabled ? (
                <div className="flex items-center gap-2 text-green-400">
                  <Zap className="w-5 h-5" />
                  <span className="font-medium">Enabled</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <ZapOff className="w-5 h-5" />
                  <span className="font-medium">Disabled</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="anam-toggle" className="text-slate-300 text-sm">
                {isToggling === 'anam' ? 'Switching...' : anamEnabled ? 'ON' : 'OFF'}
              </Label>
              <Switch
                id="anam-toggle"
                checked={anamEnabled}
                onCheckedChange={() => handleToggle('anam')}
                disabled={isToggling !== null}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>
          {settings.anam_api_enabled?.updated_by && (
            <p className="text-xs text-slate-500">
              Last changed by: {settings.anam_api_enabled.updated_by}
            </p>
          )}

          {/* API Key Section - All Admins can update */}
          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-yellow-500" />
              <Label className="text-white text-sm font-medium">Anam API Key</Label>
            </div>
            
            {/* Current key info */}
            <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
              <span className="text-slate-400">Current:</span>
              <code className={`px-2 py-1 rounded ${currentAnamKey === 'Not set' ? 'bg-red-900/50 text-red-300' : 'bg-slate-900 text-slate-300'}`}>
                {currentAnamKey}
              </code>
              {settings.anam_api_key?.updated_by && (
                <span className="text-xs text-slate-500">
                  (by {settings.anam_api_key.updated_by}
                  {settings.anam_api_key.updated_at && ` on ${new Date(settings.anam_api_key.updated_at).toLocaleDateString()}`})
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Enter your Anam API key..."
                  className="bg-slate-900 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={handleSaveApiKey}
                disabled={isSavingKey || !newApiKey.trim()}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {isSavingKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Add your own Anam API key from your free account to enable Avatar Mode.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiToggle;
