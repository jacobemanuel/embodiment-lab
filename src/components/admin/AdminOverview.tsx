import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

interface StudyStats {
  totalSessions: number;
  completedSessions: number;
  textModeSessions: number;
  avatarModeSessions: number;
  completionRate: number;
  avgSessionDuration: number;
  sessionsPerDay: { date: string; count: number }[];
  demographicBreakdown: { name: string; value: number }[];
  modeComparison: { name: string; text: number; avatar: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AdminOverview = () => {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let query = supabase
        .from('study_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data: sessions, error: sessionsError } = await query;

      if (sessionsError) throw sessionsError;

      let demoQuery = supabase.from('demographics').select('*');
      
      const { data: demographics, error: demoError } = await demoQuery;

      if (demoError) throw demoError;

      // Filter demographics by session date if dates are set
      let filteredDemographics = demographics || [];
      if (sessions && (startDate || endDate)) {
        const sessionIds = new Set(sessions.map(s => s.id));
        filteredDemographics = demographics?.filter(d => sessionIds.has(d.session_id)) || [];
      }

      const totalSessions = sessions?.length || 0;
      const completedSessions = sessions?.filter(s => s.completed_at).length || 0;
      const textModeSessions = sessions?.filter(s => s.mode === 'text').length || 0;
      const avatarModeSessions = sessions?.filter(s => s.mode === 'avatar').length || 0;
      const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

      const completedWithDuration = sessions?.filter(s => s.completed_at && s.started_at) || [];
      let avgDuration = 0;
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((sum, s) => {
          const start = new Date(s.started_at).getTime();
          const end = new Date(s.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgDuration = Math.round(totalDuration / completedWithDuration.length / 1000 / 60);
      }

      // Calculate sessions per day
      const sessionsByDay: Record<string, number> = {};
      sessions?.forEach(s => {
        const dateStr = s.created_at.split('T')[0];
        sessionsByDay[dateStr] = (sessionsByDay[dateStr] || 0) + 1;
      });

      const sortedDates = Object.keys(sessionsByDay).sort();
      const sessionsPerDay = sortedDates.map(date => ({
        date: format(parseISO(date), 'MM-dd'),
        count: sessionsByDay[date]
      }));

      const ageBreakdown: Record<string, number> = {};
      filteredDemographics.forEach(d => {
        if (d.age_range) {
          ageBreakdown[d.age_range] = (ageBreakdown[d.age_range] || 0) + 1;
        }
      });

      const modeComparison = [
        { 
          name: 'Completed', 
          text: sessions?.filter(s => s.mode === 'text' && s.completed_at).length || 0, 
          avatar: sessions?.filter(s => s.mode === 'avatar' && s.completed_at).length || 0 
        },
        { 
          name: 'In Progress', 
          text: sessions?.filter(s => s.mode === 'text' && !s.completed_at).length || 0, 
          avatar: sessions?.filter(s => s.mode === 'avatar' && !s.completed_at).length || 0 
        },
      ];

      setStats({
        totalSessions,
        completedSessions,
        textModeSessions,
        avatarModeSessions,
        completionRate,
        avgSessionDuration: avgDuration,
        sessionsPerDay,
        demographicBreakdown: Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })),
        modeComparison,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-slate-400">Error loading statistics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onRefresh={fetchStats}
        isRefreshing={isRefreshing}
        autoRefreshEnabled={autoRefresh}
        onAutoRefreshToggle={setAutoRefresh}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
            <p className="text-xs text-slate-500 mt-1">
              Text: {stats.textModeSessions} | Avatar: {stats.avatarModeSessions}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.completedSessions}</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Session Time</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.avgSessionDuration} min</div>
            <p className="text-xs text-slate-500 mt-1">for completed sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Completion Rate</CardTitle>
            <Percent className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.totalSessions - stats.completedSessions} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Sessions Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily new sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.sessionsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Mode Comparison</CardTitle>
            <CardDescription className="text-slate-400">Text Mode vs Avatar Mode</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.modeComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="text" name="Text Mode" fill="#3b82f6" />
                <Bar dataKey="avatar" name="Avatar Mode" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Age Distribution</CardTitle>
            <CardDescription className="text-slate-400">Participant demographics</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.demographicBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.demographicBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.demographicBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-slate-500">
                No demographic data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Summary</CardTitle>
            <CardDescription className="text-slate-400">Key study metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Total participants</span>
              <span className="text-white font-semibold">{stats.totalSessions}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Text Mode participants</span>
              <span className="text-blue-400 font-semibold">{stats.textModeSessions}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avatar Mode participants</span>
              <span className="text-green-400 font-semibold">{stats.avatarModeSessions}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Completion rate</span>
              <span className="text-purple-400 font-semibold">{stats.completionRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Average learning time</span>
              <span className="text-yellow-400 font-semibold">{stats.avgSessionDuration} min</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
