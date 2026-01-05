// @ts-nocheck

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Clock,
  FileEdit,
  HelpCircle,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const AdminAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAction, setFilterAction] = useState("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time subscription for audit logs
  useEffect(() => {
    const channel = supabase
      .channel("audit-log-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_audit_log" },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getActionIcon = (action) => {
    switch (action) {
      case "create":
        return <Plus className="w-4 h-4 text-green-400" />;
      case "update":
        return <FileEdit className="w-4 h-4 text-blue-400" />;
      case "delete":
        return <Trash2 className="w-4 h-4 text-red-400" />;
      default:
        return <Settings className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "create":
        return <Badge className="bg-green-900/50 text-green-300 border-green-700">Created</Badge>;
      case "update":
        return <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">Updated</Badge>;
      case "delete":
        return <Badge className="bg-red-900/50 text-red-300 border-red-700">Deleted</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case "slide":
        return <Presentation className="w-4 h-4" />;
      case "question":
        return <HelpCircle className="w-4 h-4" />;
      case "setting":
        return <Settings className="w-4 h-4" />;
      default:
        return <FileEdit className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const email = String(log?.admin_email || "");
    const entityName = log?.entity_name ? String(log.entity_name) : "";
    const entityId = log?.entity_id ? String(log.entity_id) : "";

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      email.toLowerCase().includes(q) ||
      entityName.toLowerCase().includes(q) ||
      entityId.toLowerCase().includes(q);

    const matchesType = filterType === "all" || log?.entity_type === filterType;
    const matchesAction = filterAction === "all" || log?.action_type === filterAction;

    return matchesSearch && matchesType && matchesAction;
  });

  const renderChangesPreview = (changes) => {
    let parsed = null;

    if (typeof changes === "string") {
      try {
        parsed = JSON.parse(changes);
      } catch {
        parsed = null;
      }
    } else if (changes && typeof changes === "object") {
      parsed = changes;
    }

    if (!parsed) return <span className="text-muted-foreground/70">-</span>;

    const entries = Object.entries(parsed);
    if (entries.length === 0) return <span className="text-muted-foreground/70">-</span>;

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-auto py-1 px-2">
            {entries.length} field{entries.length > 1 ? "s" : ""} changed
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white">Change Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">Detailed view of what was modified</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {entries.map(([key, value]) => (
                <div key={key} className="border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground/80 mb-2">{key}</p>

                  {value && typeof value === "object" && "old" in value && "new" in value ? (
                    <div className="space-y-2">
                      <div className="bg-red-900/20 border border-red-800/30 rounded p-2">
                        <p className="text-xs text-red-400 mb-1">Old value:</p>
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                          {typeof value.old === "object" ? JSON.stringify(value.old, null, 2) : String(value.old || "-")}
                        </pre>
                      </div>
                      <div className="bg-green-900/20 border border-green-800/30 rounded p-2">
                        <p className="text-xs text-green-400 mb-1">New value:</p>
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                          {typeof value.new === "object" ? JSON.stringify(value.new, null, 2) : String(value.new || "-")}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-xs text-foreground/80 bg-background p-2 rounded whitespace-pre-wrap overflow-x-auto">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
                Track all changes made by admins. Only you (owner) can see this log. View who changed what, when, and the
                exact details of each modification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Change History ({filteredLogs.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">All modifications made through the admin panel</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs} className="border-border">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, entity name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px] bg-background border-border">
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
              <SelectTrigger className="w-[150px] bg-background border-border">
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

          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
              <p className="text-sm mt-1">Changes made by admins will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground/80">Time</TableHead>
                    <TableHead className="text-foreground/80">Admin</TableHead>
                    <TableHead className="text-foreground/80">Action</TableHead>
                    <TableHead className="text-foreground/80">Type</TableHead>
                    <TableHead className="text-foreground/80">Entity</TableHead>
                    <TableHead className="text-foreground/80">Changes</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={String(log.id)} className="border-border hover:bg-muted/50">
                      <TableCell className="text-foreground/80 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(log.created_at), "MMM d, yyyy")}</span>
                          <span className="text-xs text-muted-foreground/70">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-foreground/80">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground/70" />
                          <span className="text-sm truncate max-w-[150px]">{String(log.admin_email || "-")}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action_type)}
                          {getActionBadge(log.action_type)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-foreground/80">
                          {getEntityIcon(log.entity_type)}
                          <span className="capitalize">{String(log.entity_type || "-")}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-foreground/80">
                        <div className="max-w-[200px]">
                          <p className="truncate text-sm">{log.entity_name || "-"}</p>
                          {log.entity_id && <p className="text-xs text-muted-foreground/70 truncate">{String(log.entity_id)}</p>}
                        </div>
                      </TableCell>

                      <TableCell>{renderChangesPreview(log.changes)}</TableCell>
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
