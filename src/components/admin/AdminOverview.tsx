import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Download, Timer, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";

interface AvatarTimeData {
  session_id: string;
  slide_id: string;
  slide_title: string;
  duration_seconds: number;
  started_at: string;
}

interface StudyStats {
  totalCompleted: number;
  textModeCompleted: number;
  avatarModeCompleted: number;
  bothModesCompleted: number;
  avgSessionDuration: number;
  avgAvatarTime: number;
  totalAvatarTime: number;
  sessionsPerDay: { date: string; count: number }[];
  demographicBreakdown: { name: string; value: number }[];
  modeComparison: { name: string; count: number }[];
  avatarTimeBySlide: { slide: string; avgTime: number; totalTime: number }[];
  avatarTimeData: AvatarTimeData[];
  preTestAvgScore: number;
  postTestAvgScore: number;
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
      // Fetch ONLY completed sessions
      let query = supabase
        .from('study_sessions')
        .select('*')
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('completed_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('completed_at', endOfDay(endDate).toISOString());
      }

      const { data: sessions, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      // Fetch demographics for completed sessions
      const sessionIds = sessions?.map(s => s.id) || [];
      let demographics: any[] = [];
      if (sessionIds.length > 0) {
        const { data: demoData } = await supabase
          .from('demographics')
          .select('*')
          .in('session_id', sessionIds);
        demographics = demoData || [];
      }

      // Fetch avatar time tracking
      let avatarTimeQuery = supabase
        .from('avatar_time_tracking')
        .select('*');
      
      if (sessionIds.length > 0) {
        avatarTimeQuery = avatarTimeQuery.in('session_id', sessionIds);
      }
      
      const { data: avatarTimeData } = await avatarTimeQuery;

      // Calculate stats - ONLY from completed sessions
      const totalCompleted = sessions?.length || 0;
      
      const textModeCompleted = sessions?.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('text')) ||
        (!s.modes_used && s.mode === 'text')
      ).length || 0;
      
      const avatarModeCompleted = sessions?.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('avatar')) ||
        (!s.modes_used && s.mode === 'avatar')
      ).length || 0;
      
      const bothModesCompleted = sessions?.filter(s => 
        s.modes_used?.includes('text') && s.modes_used?.includes('avatar')
      ).length || 0;

      // Average session duration
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

      // Avatar time stats
      const totalAvatarTime = avatarTimeData?.reduce((sum, t) => sum + (t.duration_seconds || 0), 0) || 0;
      const avatarSessions = new Set(avatarTimeData?.map(t => t.session_id) || []);
      const avgAvatarTime = avatarSessions.size > 0 ? Math.round(totalAvatarTime / avatarSessions.size) : 0;

      // Avatar time by slide
      const slideTimeMap: Record<string, { total: number; count: number; title: string }> = {};
      avatarTimeData?.forEach(t => {
        if (!slideTimeMap[t.slide_id]) {
          slideTimeMap[t.slide_id] = { total: 0, count: 0, title: t.slide_title };
        }
        slideTimeMap[t.slide_id].total += t.duration_seconds || 0;
        slideTimeMap[t.slide_id].count += 1;
      });

      const avatarTimeBySlide = Object.entries(slideTimeMap).map(([slideId, data]) => ({
        slide: data.title || slideId,
        avgTime: Math.round(data.total / data.count),
        totalTime: data.total,
      }));

      // Sessions per day (completed only)
      const sessionsByDay: Record<string, number> = {};
      sessions?.forEach(s => {
        const dateStr = s.completed_at?.split('T')[0] || s.created_at.split('T')[0];
        sessionsByDay[dateStr] = (sessionsByDay[dateStr] || 0) + 1;
      });

      const sortedDates = Object.keys(sessionsByDay).sort();
      const sessionsPerDay = sortedDates.map(date => ({
        date: format(parseISO(date), 'MM-dd'),
        count: sessionsByDay[date]
      }));

      // Age breakdown
      const ageBreakdown: Record<string, number> = {};
      demographics.forEach(d => {
        if (d.age_range) {
          ageBreakdown[d.age_range] = (ageBreakdown[d.age_range] || 0) + 1;
        }
      });

      // Mode comparison (completed only)
      const modeComparison = [
        { name: 'Text Only', count: textModeCompleted },
        { name: 'Avatar Only', count: avatarModeCompleted },
        { name: 'Both Modes', count: bothModesCompleted },
      ];

      // Fetch pre/post test scores for knowledge gain
      let preTestAvg = 0;
      let postTestAvg = 0;
      
      if (sessionIds.length > 0) {
        const { data: preTestResponses } = await supabase
          .from('pre_test_responses')
          .select('*')
          .in('session_id', sessionIds);
        
        const { data: postTestResponses } = await supabase
          .from('post_test_responses')
          .select('*')
          .in('session_id', sessionIds);
        
        // Calculate average scores (simplified - would need correct answers for accuracy)
        const preTestCount = preTestResponses?.length || 0;
        const postTestCount = postTestResponses?.length || 0;
        preTestAvg = preTestCount > 0 ? Math.round((preTestCount / (sessionIds.length * 10)) * 100) : 0;
        postTestAvg = postTestCount > 0 ? Math.round((postTestCount / (sessionIds.length * 10)) * 100) : 0;
      }

      setStats({
        totalCompleted,
        textModeCompleted,
        avatarModeCompleted,
        bothModesCompleted,
        avgSessionDuration: avgDuration,
        avgAvatarTime,
        totalAvatarTime,
        sessionsPerDay,
        demographicBreakdown: Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })),
        modeComparison,
        avatarTimeBySlide,
        avatarTimeData: avatarTimeData || [],
        preTestAvgScore: preTestAvg,
        postTestAvgScore: postTestAvg,
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

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  const exportAvatarTimeCSV = () => {
    if (!stats?.avatarTimeData.length) return;
    
    const headers = ['Session ID', 'Slide ID', 'Slide Title', 'Duration (seconds)', 'Started At'];
    const rows = stats.avatarTimeData.map(t => [
      t.session_id,
      t.slide_id,
      t.slide_title,
      t.duration_seconds.toString(),
      t.started_at,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avatar-time-tracking-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Info banner - completed only */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 text-sm text-blue-200">
        📊 Statistics show <strong>completed sessions only</strong> - participants who finished the entire study flow.
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Completed Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalCompleted}</div>
            <p className="text-xs text-slate-500 mt-1">fully completed studies</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Session Time</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.avgSessionDuration} min</div>
            <p className="text-xs text-slate-500 mt-1">from start to completion</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Avatar Time</CardTitle>
            <Timer className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Math.round(stats.avgAvatarTime / 60)} min</div>
            <p className="text-xs text-slate-500 mt-1">per avatar session</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Mode Distribution</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-blue-400">Text:</span><span className="text-white">{stats.textModeCompleted}</span></div>
              <div className="flex justify-between"><span className="text-green-400">Avatar:</span><span className="text-white">{stats.avatarModeCompleted}</span></div>
              <div className="flex justify-between"><span className="text-cyan-400">Both:</span><span className="text-white">{stats.bothModesCompleted}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avatar Time Tracking Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Avatar Interaction Time</CardTitle>
            <CardDescription className="text-slate-400">Time spent with avatar per slide (seconds)</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportAvatarTimeCSV}
            disabled={!stats.avatarTimeData.length}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {stats.avatarTimeBySlide.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.avatarTimeBySlide}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="slide" stroke="#9ca3af" fontSize={10} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="#9ca3af" fontSize={12} label={{ value: 'Avg seconds', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`${value}s`, 'Avg Time']}
                />
                <Bar dataKey="avgTime" name="Avg Time" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-500">
              No avatar interaction data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Completed Sessions Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily completed studies</CardDescription>
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
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Mode Distribution</CardTitle>
            <CardDescription className="text-slate-400">Completed sessions by learning mode</CardDescription>
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
                <Bar dataKey="count" name="Completed" fill="#3b82f6" />
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
            <CardDescription className="text-slate-400">Completed participants demographics</CardDescription>
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
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
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
            <CardDescription className="text-slate-400">Key metrics for completed participants only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Total completed</span>
              <span className="text-white font-semibold">{stats.totalCompleted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Text Mode only</span>
              <span className="text-blue-400 font-semibold">{stats.textModeCompleted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avatar Mode only</span>
              <span className="text-green-400 font-semibold">{stats.avatarModeCompleted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Used both modes</span>
              <span className="text-cyan-400 font-semibold">{stats.bothModesCompleted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. learning time</span>
              <span className="text-yellow-400 font-semibold">{stats.avgSessionDuration} min</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. avatar interaction</span>
              <span className="text-purple-400 font-semibold">{Math.round(stats.avgAvatarTime / 60)} min</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Total avatar time</span>
              <span className="text-purple-400 font-semibold">{Math.round(stats.totalAvatarTime / 60)} min</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
