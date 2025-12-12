import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { preTestQuestions, demographicQuestions } from "@/data/questions";
import { postTestQuestions } from "@/data/postTestQuestions";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ResponseData {
  question_id: string;
  answer: string;
  count: number;
}

const AdminResponses = () => {
  const [preTestData, setPreTestData] = useState<Record<string, ResponseData[]>>({});
  const [postTestData, setPostTestData] = useState<Record<string, ResponseData[]>>({});
  const [demographicsData, setDemographicsData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllResponses();
  }, []);

  const fetchAllResponses = async () => {
    try {
      const { data: preTest } = await supabase
        .from('pre_test_responses')
        .select('question_id, answer');

      const { data: postTest } = await supabase
        .from('post_test_responses')
        .select('question_id, answer');

      const { data: demographics } = await supabase
        .from('demographics')
        .select('*');

      const preTestAggregated: Record<string, ResponseData[]> = {};
      preTest?.forEach(r => {
        if (!preTestAggregated[r.question_id]) {
          preTestAggregated[r.question_id] = [];
        }
        const existing = preTestAggregated[r.question_id].find(x => x.answer === r.answer);
        if (existing) {
          existing.count++;
        } else {
          preTestAggregated[r.question_id].push({ question_id: r.question_id, answer: r.answer, count: 1 });
        }
      });

      const postTestAggregated: Record<string, ResponseData[]> = {};
      postTest?.forEach(r => {
        if (!postTestAggregated[r.question_id]) {
          postTestAggregated[r.question_id] = [];
        }
        const existing = postTestAggregated[r.question_id].find(x => x.answer === r.answer);
        if (existing) {
          existing.count++;
        } else {
          postTestAggregated[r.question_id].push({ question_id: r.question_id, answer: r.answer, count: 1 });
        }
      });

      const demoAggregated: Record<string, { name: string; value: number }[]> = {
        age_range: [],
        education: [],
        digital_experience: []
      };

      demographics?.forEach(d => {
        ['age_range', 'education', 'digital_experience'].forEach(key => {
          const value = d[key as keyof typeof d];
          if (value) {
            const existing = demoAggregated[key].find(x => x.name === value);
            if (existing) {
              existing.value++;
            } else {
              demoAggregated[key].push({ name: value as string, value: 1 });
            }
          }
        });
      });

      setPreTestData(preTestAggregated);
      setPostTestData(postTestAggregated);
      setDemographicsData(demoAggregated);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportAllData = async () => {
    try {
      const { data: sessions } = await supabase.from('study_sessions').select('*');
      const { data: demographics } = await supabase.from('demographics').select('*');
      const { data: preTest } = await supabase.from('pre_test_responses').select('*');
      const { data: postTest } = await supabase.from('post_test_responses').select('*');
      const { data: scenarios } = await supabase.from('scenarios').select('*');
      const { data: dialogues } = await supabase.from('dialogue_turns').select('*');

      const exportData = {
        sessions,
        demographics,
        preTestResponses: preTest,
        postTestResponses: postTest,
        scenarios,
        dialogueTurns: dialogues,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_study_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getQuestionText = (questionId: string, type: 'pre' | 'post' | 'demo'): string => {
    if (type === 'pre') {
      return preTestQuestions.find(q => q.id === questionId)?.text || questionId;
    } else if (type === 'post') {
      return postTestQuestions.find(q => q.id === questionId)?.text || questionId;
    } else {
      return demographicQuestions.find(q => q.id === questionId)?.text || questionId;
    }
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
      <div className="flex justify-end">
        <Button onClick={exportAllData} variant="outline" className="border-slate-600">
          <Download className="w-4 h-4 mr-2" />
          Export All Data (JSON)
        </Button>
      </div>

      <Tabs defaultValue="demographics" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="pretest">Pre-test</TabsTrigger>
          <TabsTrigger value="posttest">Post-test</TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Age</CardTitle>
              </CardHeader>
              <CardContent>
                {demographicsData.age_range?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={demographicsData.age_range}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {demographicsData.age_range.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Education</CardTitle>
              </CardHeader>
              <CardContent>
                {demographicsData.education?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demographicsData.education} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" />
                      <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Digital Experience</CardTitle>
              </CardHeader>
              <CardContent>
                {demographicsData.digital_experience?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demographicsData.digital_experience}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Bar dataKey="value" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pretest" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(preTestData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId, 'pre');
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={responses} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis 
                          dataKey="answer" 
                          type="category" 
                          stroke="#9ca3af" 
                          width={150}
                          fontSize={10}
                          tickFormatter={(value) => value.length > 25 ? value.slice(0, 25) + '...' : value}
                        />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(preTestData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No pre-test data</p>
          )}
        </TabsContent>

        <TabsContent value="posttest" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(postTestData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId, 'post');
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={responses} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis 
                          dataKey="answer" 
                          type="category" 
                          stroke="#9ca3af" 
                          width={150}
                          fontSize={10}
                          tickFormatter={(value) => value.length > 25 ? value.slice(0, 25) + '...' : value}
                        />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="count" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(postTestData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No post-test data</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminResponses;