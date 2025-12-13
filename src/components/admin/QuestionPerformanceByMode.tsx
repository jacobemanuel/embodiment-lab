import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Download, TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfDay, endOfDay, format } from "date-fns";

interface QuestionModePerformance {
  questionId: string;
  questionText: string;
  questionType: 'pre_test' | 'post_test';
  textCorrectRate: number;
  avatarCorrectRate: number;
  textResponses: number;
  avatarResponses: number;
  difference: number; // avatar - text (positive = avatar better)
  hasCorrectAnswer: boolean;
}

interface Props {
  startDate?: Date;
  endDate?: Date;
  userEmail?: string;
}

import { getPermissions } from "@/lib/permissions";

const QuestionPerformanceByMode = ({ startDate, endDate, userEmail = '' }: Props) => {
  const permissions = getPermissions(userEmail);
  const [data, setData] = useState<QuestionModePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch sessions with mode info
      let sessionQuery = supabase
        .from('study_sessions')
        .select('id, mode, modes_used, completed_at')
        .not('completed_at', 'is', null);

      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data: sessions } = await sessionQuery;
      if (!sessions?.length) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // Categorize sessions by mode
      const getSessionMode = (s: any): 'text' | 'avatar' | 'both' => {
        const modesUsed = s.modes_used && s.modes_used.length > 0 ? s.modes_used : [s.mode];
        if (modesUsed.includes('text') && modesUsed.includes('avatar')) return 'both';
        if (modesUsed.includes('avatar')) return 'avatar';
        return 'text';
      };

      const textSessionIds = sessions.filter(s => getSessionMode(s) === 'text').map(s => s.id);
      const avatarSessionIds = sessions.filter(s => getSessionMode(s) === 'avatar').map(s => s.id);

      // Fetch questions with correct answers
      const { data: questions } = await supabase
        .from('study_questions')
        .select('question_id, question_text, correct_answer, question_type')
        .eq('is_active', true)
        .in('question_type', ['pre_test', 'post_test']);

      const questionMap = new Map(questions?.map(q => [q.question_id, q]) || []);

      // Fetch responses
      const [preTestRes, postTestRes] = await Promise.all([
        supabase.from('pre_test_responses').select('*').in('session_id', [...textSessionIds, ...avatarSessionIds]),
        supabase.from('post_test_responses').select('*').in('session_id', [...textSessionIds, ...avatarSessionIds]),
      ]);

      const allResponses = [
        ...(preTestRes.data || []).map(r => ({ ...r, type: 'pre_test' })),
        ...(postTestRes.data || []).filter(r => r.question_id.startsWith('knowledge-')).map(r => ({ ...r, type: 'post_test' })),
      ];

      // Group by question and mode
      const questionStats: Record<string, {
        textCorrect: number;
        textTotal: number;
        avatarCorrect: number;
        avatarTotal: number;
      }> = {};

      allResponses.forEach(r => {
        const question = questionMap.get(r.question_id);
        if (!question?.correct_answer) return;

        const isTextMode = textSessionIds.includes(r.session_id);
        const isAvatarMode = avatarSessionIds.includes(r.session_id);
        if (!isTextMode && !isAvatarMode) return;

        if (!questionStats[r.question_id]) {
          questionStats[r.question_id] = { textCorrect: 0, textTotal: 0, avatarCorrect: 0, avatarTotal: 0 };
        }

        const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
        const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
        const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) &&
                         userAnswers.every((ua: string) => correctAnswers.includes(ua));

        if (isTextMode) {
          questionStats[r.question_id].textTotal++;
          if (isCorrect) questionStats[r.question_id].textCorrect++;
        } else if (isAvatarMode) {
          questionStats[r.question_id].avatarTotal++;
          if (isCorrect) questionStats[r.question_id].avatarCorrect++;
        }
      });

      // Build result
      const result: QuestionModePerformance[] = [];
      Object.entries(questionStats).forEach(([qId, stats]) => {
        const question = questionMap.get(qId);
        if (!question) return;
        if (stats.textTotal === 0 && stats.avatarTotal === 0) return;

        const textRate = stats.textTotal > 0 ? Math.round((stats.textCorrect / stats.textTotal) * 100) : 0;
        const avatarRate = stats.avatarTotal > 0 ? Math.round((stats.avatarCorrect / stats.avatarTotal) * 100) : 0;

        result.push({
          questionId: qId,
          questionText: question.question_text,
          questionType: question.question_type.includes('pre') ? 'pre_test' : 'post_test',
          textCorrectRate: textRate,
          avatarCorrectRate: avatarRate,
          textResponses: stats.textTotal,
          avatarResponses: stats.avatarTotal,
          difference: avatarRate - textRate,
          hasCorrectAnswer: !!question.correct_answer,
        });
      });

      // Sort by difference (biggest avatar advantage first)
      result.sort((a, b) => b.difference - a.difference);

      setData(result);
    } catch (error) {
      console.error('Error fetching question performance by mode:', error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCSV = () => {
    if (!data.length) return;
    const csv = [
      'Question ID,Question Text,Type,Text Mode %,Avatar Mode %,Difference,Text n,Avatar n',
      ...data.map(d => 
        `"${d.questionId}","${d.questionText.replace(/"/g, '""')}",${d.questionType},${d.textCorrectRate},${d.avatarCorrectRate},${d.difference},${d.textResponses},${d.avatarResponses}`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question_performance_by_mode_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const preTestData = data.filter(d => d.questionType === 'pre_test');
  const postTestData = data.filter(d => d.questionType === 'post_test');

  // Find biggest differences
  const biggestAvatarAdvantage = [...data].sort((a, b) => b.difference - a.difference)[0];
  const biggestTextAdvantage = [...data].sort((a, b) => a.difference - b.difference)[0];

  const chartData = data.map(d => ({
    name: d.questionId.length > 15 ? d.questionId.slice(0, 15) + '...' : d.questionId,
    fullName: d.questionId,
    text: d.textCorrectRate,
    avatar: d.avatarCorrectRate,
    diff: d.difference,
  }));

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              Question Performance by Mode
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-slate-700 border-slate-600">
                    <p className="text-sm">
                      Compares correct answer rates between Text Mode and Avatar Mode for each question.
                      Positive difference = Avatar performed better. Useful for identifying which concepts
                      benefited most from avatar-based learning.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Text vs Avatar mode performance per question (only questions with correct answers)
            </CardDescription>
          </div>
          {permissions.canExportData && (
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 border-slate-600">
              <Download className="w-4 h-4" />
              CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No data available. Ensure questions have correct answers marked and both modes have responses.</p>
          </div>
        ) : (
          <>
            {/* Key Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {biggestAvatarAdvantage && biggestAvatarAdvantage.difference > 0 && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-300 font-medium">Biggest Avatar Advantage</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-1">{biggestAvatarAdvantage.questionText.slice(0, 80)}...</p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600">+{biggestAvatarAdvantage.difference}%</Badge>
                    <span className="text-xs text-slate-400">
                      Text: {biggestAvatarAdvantage.textCorrectRate}% → Avatar: {biggestAvatarAdvantage.avatarCorrectRate}%
                    </span>
                  </div>
                </div>
              )}
              {biggestTextAdvantage && biggestTextAdvantage.difference < 0 && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-blue-400" />
                    <span className="text-blue-300 font-medium">Biggest Text Advantage</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-1">{biggestTextAdvantage.questionText.slice(0, 80)}...</p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">{biggestTextAdvantage.difference}%</Badge>
                    <span className="text-xs text-slate-400">
                      Text: {biggestTextAdvantage.textCorrectRate}% → Avatar: {biggestTextAdvantage.avatarCorrectRate}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Correct Answer Rate by Mode</h4>
                <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={11} unit="%" />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={10} width={100} />
                    <ChartTooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number, name: string) => [`${value}%`, name === 'text' ? 'Text Mode' : 'Avatar Mode']}
                      labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                    />
                    <Legend 
                      formatter={(value) => value === 'text' ? 'Text Mode' : 'Avatar Mode'}
                    />
                    <Bar dataKey="text" fill="#3b82f6" name="text" />
                    <Bar dataKey="avatar" fill="#10b981" name="avatar" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pre-test Details */}
            {preTestData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Pre-Test Questions</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {preTestData.map(q => (
                    <div key={q.questionId} className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{q.questionText}</p>
                        <p className="text-xs text-slate-500">{q.questionId}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-center">
                          <div className="text-xs text-blue-400">Text</div>
                          <div className="text-sm font-medium text-white">{q.textCorrectRate}%</div>
                          <div className="text-xs text-slate-500">n={q.textResponses}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-emerald-400">Avatar</div>
                          <div className="text-sm font-medium text-white">{q.avatarCorrectRate}%</div>
                          <div className="text-xs text-slate-500">n={q.avatarResponses}</div>
                        </div>
                        <Badge className={`${
                          q.difference > 5 ? 'bg-emerald-600' : 
                          q.difference < -5 ? 'bg-blue-600' : 
                          'bg-slate-600'
                        }`}>
                          {q.difference > 0 ? '+' : ''}{q.difference}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-test Details */}
            {postTestData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Post-Test Knowledge Questions</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {postTestData.map(q => (
                    <div key={q.questionId} className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{q.questionText}</p>
                        <p className="text-xs text-slate-500">{q.questionId}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-center">
                          <div className="text-xs text-blue-400">Text</div>
                          <div className="text-sm font-medium text-white">{q.textCorrectRate}%</div>
                          <div className="text-xs text-slate-500">n={q.textResponses}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-emerald-400">Avatar</div>
                          <div className="text-sm font-medium text-white">{q.avatarCorrectRate}%</div>
                          <div className="text-xs text-slate-500">n={q.avatarResponses}</div>
                        </div>
                        <Badge className={`${
                          q.difference > 5 ? 'bg-emerald-600' : 
                          q.difference < -5 ? 'bg-blue-600' : 
                          'bg-slate-600'
                        }`}>
                          {q.difference > 0 ? '+' : ''}{q.difference}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionPerformanceByMode;
