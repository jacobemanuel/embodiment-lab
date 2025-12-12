import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Search, Clock, User, FileEdit, Plus, Trash2, Settings, Presentation, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AuditLogEntry {
  id: string;
  admin_email: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes: any;
  created_at: string;
}

const AdminAuditLog = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as AuditLogEntry[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus className="w-4 h-4 text-green-400" />;
      case 'update': return <FileEdit className="w-4 h-4 text-blue-400" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-400" />;
      default: return <Settings className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create': return <Badge className="bg-green-900/50 text-green-300 border-green-700">Created</Badge>;
      case 'update': return <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">Updated</Badge>;
      case 'delete': return <Badge className="bg-red-900/50 text-red-300 border-red-700">Deleted</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'slide': return <Presentation className="w-4 h-4" />;
      case 'question': return <HelpCircle className="w-4 h-4" />;
      case 'setting': return <Settings className="w-4 h-4" />;
      default: return <FileEdit className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.admin_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "all" || log.entity_type === filterType;
    const matchesAction = filterAction === "all" || log.action_type === filterAction;
    
    return matchesSearch && matchesType && matchesAction;
  });

  const renderChangesPreview = (changes: any) => {
    // Parse if string
    const parsedChanges = typeof changes === 'string' ? JSON.parse(changes) : changes as Record<string, any> | null;
    if (!parsedChanges) return <span className="text-slate-500">-</span>;
    
    const keys = Object.keys(parsedChanges);
    if (keys.length === 0) return <span className="text-slate-500">-</span>;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-auto py-1 px-2">
            {keys.length} field{keys.length > 1 ? 's' : ''} changed
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white">Change Details</DialogTitle>
            <DialogDescription className="text-slate-400">
              Detailed view of what was modified
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {Object.entries(parsedChanges).map(([key, value]) => (
                <div key={key} className="border border-slate-700 rounded-lg p-3">
                  <p className="text-sm font-medium text-slate-300 mb-2">{key}</p>
                  {typeof value === 'object' && value !== null && 'old' in value && 'new' in value ? (
                    <div className="space-y-2">
                      <div className="bg-red-900/20 border border-red-800/30 rounded p-2">
                        <p className="text-xs text-red-400 mb-1">Old value:</p>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">
                          {typeof value.old === 'object' ? JSON.stringify(value.old, null, 2) : String(value.old || '-')}
                        </pre>
                      </div>
                      <div className="bg-green-900/20 border border-green-800/30 rounded p-2">
                        <p className="text-xs text-green-400 mb-1">New value:</p>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">
                          {typeof value.new === 'object' ? JSON.stringify(value.new, null, 2) : String(value.new || '-')}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-xs text-slate-300 bg-slate-900 p-2 rounded whitespace-pre-wrap overflow-x-auto">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-amber-900/20 border-amber-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium">Activity Audit Log</p>
              <p className="text-amber-300/70 text-sm mt-1">
                Track all changes made by admins. Only you (owner) can see this log.
                View who changed what, when, and the exact details of each modification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Change History ({filteredLogs.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                All modifications made through the admin panel
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              className="border-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by email, entity name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-600"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="slide">Slides</SelectItem>
                <SelectItem value="question">Questions</SelectItem>
                <SelectItem value="setting">Settings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
              <p className="text-sm mt-1">Changes made by admins will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300">Time</TableHead>
                    <TableHead className="text-slate-300">Admin</TableHead>
                    <TableHead className="text-slate-300">Action</TableHead>
                    <TableHead className="text-slate-300">Type</TableHead>
                    <TableHead className="text-slate-300">Entity</TableHead>
                    <TableHead className="text-slate-300">Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(log.created_at), 'MMM d, yyyy')}</span>
                          <span className="text-xs text-slate-500">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="text-sm truncate max-w-[150px]">{log.admin_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action_type)}
                          {getActionBadge(log.action_type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-300">
                          {getEntityIcon(log.entity_type)}
                          <span className="capitalize">{log.entity_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="max-w-[200px]">
                          <p className="truncate text-sm">{log.entity_name || '-'}</p>
                          {log.entity_id && (
                            <p className="text-xs text-slate-500 truncate">{log.entity_id}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderChangesPreview(log.changes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLog;
