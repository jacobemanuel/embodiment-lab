import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Trash2, Save, CheckCircle, XCircle, RefreshCw, Edit2, Lock } from "lucide-react";
import { logAdminAction, computeChanges } from "@/lib/auditLog";
import { getPermissions } from "@/lib/permissions";

interface StudyQuestion {
  id: string;
  question_type: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_answer: string | null; // Stored as "|||" separated for multiple
  category: string | null;
  question_meta: Record<string, any>;
  sort_order: number;
  is_active: boolean;
}

// Helper to parse correct answers (supports multiple via ||| separator)
const parseCorrectAnswers = (correct_answer: string | null): string[] => {
  if (!correct_answer) return [];
  return correct_answer.split('|||').map(a => a.trim()).filter(Boolean);
};

// Helper to serialize correct answers
const serializeCorrectAnswers = (answers: string[]): string | null => {
  if (answers.length === 0) return null;
  return answers.join('|||');
};

interface AdminQuestionsProps {
  userEmail: string;
}

const AdminQuestions = ({ userEmail }: AdminQuestionsProps) => {
  const permissions = getPermissions(userEmail);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<StudyQuestion>>({});

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('study_questions')
        .select('*')
        .order('question_type')
        .order('sort_order');

      if (error) throw error;

      // Parse options from JSON
      const parsed = data?.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        question_meta: typeof q.question_meta === 'string' ? JSON.parse(q.question_meta) : q.question_meta || {}
      })) || [];

      setQuestions(parsed);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Real-time subscription for questions
  useEffect(() => {
    const channel = supabase
      .channel('questions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_questions' }, () => fetchQuestions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const startEditing = (question: StudyQuestion) => {
    setEditingQuestion(question.id);
    setEditedData({
      question_text: question.question_text,
      options: [...question.options],
      correct_answer: question.correct_answer, // Keep as string, will parse when needed
      category: question.category,
    });
  };

  const cancelEditing = () => {
    setEditingQuestion(null);
    setEditedData({});
  };

  const saveQuestion = async (questionId: string, question: StudyQuestion) => {
    setIsSaving(true);
    try {
      // Determine the question meta type based on category
      let metaType = 'multiple-choice';
      if (['trust', 'engagement', 'satisfaction'].includes(editedData.category || '')) {
        metaType = 'likert';
      }

      const { error } = await supabase
        .from('study_questions')
        .update({
          question_text: editedData.question_text,
          options: editedData.options,
          correct_answer: editedData.correct_answer,
          category: editedData.category,
          question_meta: { ...question.question_meta, type: metaType },
        })
        .eq('id', questionId);

      if (error) throw error;

      // Log the change
      const changes = computeChanges(
        question,
        editedData as Record<string, any>,
        ['question_text', 'options', 'correct_answer', 'category']
      );
      await logAdminAction({
        actionType: 'update',
        entityType: 'question',
        entityId: question.question_id,
        entityName: editedData.question_text || question.question_text,
        changes,
      });

      toast.success('Question saved successfully! Changes are now live.');
      setEditingQuestion(null);
      setEditedData({});
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const addOption = () => {
    if (!editedData.options) return;
    setEditedData({
      ...editedData,
      options: [...editedData.options, 'New option'],
    });
  };

  const removeOption = (index: number) => {
    if (!editedData.options) return;
    const removedOption = editedData.options[index];
    const newOptions = editedData.options.filter((_, i) => i !== index);
    
    // Remove from correct answers if it was there
    const currentCorrect = parseCorrectAnswers(editedData.correct_answer || null);
    const newCorrect = currentCorrect.filter(a => a !== removedOption);
    
    setEditedData({
      ...editedData,
      options: newOptions,
      correct_answer: serializeCorrectAnswers(newCorrect),
    });
  };

  const updateOption = (index: number, value: string) => {
    if (!editedData.options) return;
    const newOptions = [...editedData.options];
    const oldValue = newOptions[index];
    newOptions[index] = value;
    
    // Update correct answers if the option text changed
    const currentCorrect = parseCorrectAnswers(editedData.correct_answer || null);
    const newCorrect = currentCorrect.map(a => a === oldValue ? value : a);
    
    setEditedData({
      ...editedData,
      options: newOptions,
      correct_answer: serializeCorrectAnswers(newCorrect),
    });
  };

  // Toggle correct answer (supports multiple)
  const toggleCorrectAnswer = (option: string) => {
    const currentCorrect = parseCorrectAnswers(editedData.correct_answer || null);
    let newCorrect: string[];
    
    if (currentCorrect.includes(option)) {
      // Remove from correct answers
      newCorrect = currentCorrect.filter(a => a !== option);
    } else {
      // Add to correct answers
      newCorrect = [...currentCorrect, option];
    }
    
    setEditedData({
      ...editedData,
      correct_answer: serializeCorrectAnswers(newCorrect),
    });
  };

  const addNewQuestion = async (questionType: string, category?: string, metaType?: string) => {
    const maxOrder = questions
      .filter(q => q.question_type === questionType)
      .reduce((max, q) => Math.max(max, q.sort_order), 0);

    const newQuestionId = `${questionType.replace('_', '-')}-${Date.now()}`;

    // Set default options based on type
    let defaultOptions = ['Option 1', 'Option 2'];
    if (metaType === 'likert') {
      defaultOptions = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
    }

    try {
      const { error } = await supabase
        .from('study_questions')
        .insert({
          question_type: questionType,
          question_id: newQuestionId,
          question_text: 'New question',
          options: defaultOptions,
          sort_order: maxOrder + 1,
          is_active: true,
          category: category || null,
          question_meta: metaType ? { type: metaType } : {},
        });

      if (error) throw error;

      // Log the action
      await logAdminAction({
        actionType: 'create',
        entityType: 'question',
        entityId: newQuestionId,
        entityName: 'New question',
      });

      toast.success('New question added');
      fetchQuestions();
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!permissions.canDeleteQuestions) {
      toast.error('You do not have permission to delete questions. You can disable them instead.');
      return;
    }
    if (!confirm('Are you sure you want to delete this question?')) return;

    const questionToDelete = questions.find(q => q.id === questionId);

    try {
      const { error } = await supabase
        .from('study_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      // Log the action
      if (questionToDelete) {
        await logAdminAction({
          actionType: 'delete',
          entityType: 'question',
          entityId: questionToDelete.question_id,
          entityName: questionToDelete.question_text,
        });
      }

      toast.success('Question deleted');
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const toggleQuestionActive = async (question: StudyQuestion) => {
    try {
      const { error } = await supabase
        .from('study_questions')
        .update({ is_active: !question.is_active })
        .eq('id', question.id);

      if (error) throw error;

      // Log the change
      await logAdminAction({
        actionType: 'update',
        entityType: 'question',
        entityId: question.question_id,
        entityName: question.question_text,
        changes: { is_active: { old: question.is_active, new: !question.is_active } },
      });

      toast.success(question.is_active ? 'Question disabled' : 'Question enabled');
      fetchQuestions();
    } catch (error) {
      console.error('Error toggling question:', error);
      toast.error('Failed to update question');
    }
  };

  const getQuestionsByType = (type: string) => 
    questions.filter(q => q.question_type === type);

  const renderQuestionEditor = (question: StudyQuestion) => {
    const isEditing = editingQuestion === question.id;
    const data = isEditing ? editedData : question;

    return (
      <AccordionItem 
        key={question.id} 
        value={question.id}
        className={`border rounded-lg px-4 ${question.is_active ? 'border-slate-700' : 'border-red-900/50 bg-red-900/10'}`}
      >
        <AccordionTrigger className="text-white hover:no-underline">
          <div className="flex items-center gap-3 flex-1">
            <Badge variant="outline" className="text-xs">{question.question_id}</Badge>
            <span className={`text-left flex-1 ${!question.is_active ? 'text-red-400 line-through' : ''}`}>
              {question.question_text.slice(0, 60)}...
            </span>
            {!question.is_active && (
              <Badge variant="destructive" className="text-xs">Disabled</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <div>
            <Label className="text-slate-300">Question Text</Label>
            <Textarea
              value={isEditing ? data.question_text : question.question_text}
              onChange={(e) => isEditing && setEditedData({ ...editedData, question_text: e.target.value })}
              className="mt-1 bg-slate-900 border-slate-600"
              disabled={!isEditing}
            />
          </div>

          {question.category && question.question_type !== 'open_feedback' && (
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select
                value={isEditing ? data.category || '' : question.category}
                onValueChange={(value) => isEditing && setEditedData({ ...editedData, category: value })}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expectations">Expectations</SelectItem>
                  <SelectItem value="avatar-qualities">Avatar Qualities</SelectItem>
                  <SelectItem value="realism">Realism</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="satisfaction">Satisfaction</SelectItem>
                  <SelectItem value="knowledge">Knowledge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {question.question_type !== 'open_feedback' && (
            <div>
              <Label className="text-slate-300">Answer Options</Label>
              <p className="text-slate-500 text-xs mt-1 mb-2">
                Click ✓ to mark correct answers. You can select multiple correct answers.
              </p>
              <div className="space-y-2 mt-2">
                {(isEditing ? data.options || [] : question.options).map((option, oIndex) => {
                  const correctAnswers = parseCorrectAnswers(isEditing ? data.correct_answer || null : question.correct_answer);
                  const isCorrect = correctAnswers.includes(option);
                  
                  return (
                    <div key={oIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => isEditing && updateOption(oIndex, e.target.value)}
                        className={`bg-slate-900 border-slate-600 ${isCorrect ? 'border-green-500' : ''}`}
                        disabled={!isEditing}
                      />
                      {question.correct_answer !== undefined && (
                        <Button
                          size="sm"
                          variant={isCorrect ? "default" : "outline"}
                          onClick={() => isEditing && toggleCorrectAnswer(option)}
                          className={isCorrect ? 'bg-green-600' : 'border-slate-600'}
                          disabled={!isEditing}
                        >
                          ✓
                        </Button>
                      )}
                      {isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeOption(oIndex)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addOption}
                    className="border-slate-600"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Option
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {question.question_type === 'open_feedback' && (
            <div className="text-slate-400 text-sm bg-slate-800/50 p-3 rounded">
              <p>📝 Open-ended question - participants provide free-text responses (max 200 characters)</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
            {isEditing ? (
              <>
                <Button
                  onClick={() => saveQuestion(question.id, question)}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Save & Deploy Live
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                  className="border-slate-600"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {permissions.canEditQuestions ? (
                  <Button
                    onClick={() => startEditing(question)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Question
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" disabled className="border-slate-600 opacity-50">
                          <Lock className="w-4 h-4 mr-2" />
                          View Only
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-700 text-slate-100 border-slate-600">
                        <p className="text-sm">You have read-only access</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {permissions.canDisableQuestions && (
                  <Button
                    variant="outline"
                    onClick={() => toggleQuestionActive(question)}
                    className={question.is_active ? 'border-yellow-600 text-yellow-400' : 'border-green-600 text-green-400'}
                  >
                    {question.is_active ? 'Disable' : 'Enable'}
                  </Button>
                )}
                {permissions.canDeleteQuestions ? (
                  <Button
                    variant="ghost"
                    onClick={() => deleteQuestion(question.id)}
                    className="text-red-400 hover:text-red-300 ml-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="ml-auto flex items-center gap-1 text-slate-500 cursor-not-allowed opacity-50 px-3">
                          <Lock className="w-4 h-4" />
                          <span className="text-xs">Delete (Owner only)</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-700 text-slate-100 border-slate-600 max-w-xs">
                        <p className="text-sm">Deleting questions is restricted to the owner. You can disable them instead.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const preTestQuestions = getQuestionsByType('pre_test');
  const postTestQuestions = getQuestionsByType('post_test');
  const demographicQuestions = getQuestionsByType('demographic');

  return (
    <div className="space-y-6">
      <Card className="bg-green-900/20 border-green-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-green-200 font-medium">Live Question Editing</p>
              <p className="text-green-300/70 text-sm mt-1">
                Changes are saved directly to the database and go live immediately on the platform.
                Click "Edit Question" to modify, then "Save & Deploy Live" to publish changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pretest" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="pretest">Pre-test ({preTestQuestions.length})</TabsTrigger>
          <TabsTrigger value="posttest">Post-test ({postTestQuestions.length})</TabsTrigger>
          <TabsTrigger value="demographics">Demographics ({demographicQuestions.length})</TabsTrigger>
        </TabsList>

        {/* Pre-test Questions */}
        <TabsContent value="pretest" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Pre-test Questions</CardTitle>
                <CardDescription className="text-slate-400">
                  Test questions shown before the learning phase
                </CardDescription>
              </div>
              {permissions.canCreateQuestions && (
                <Button 
                  onClick={() => addNewQuestion('pre_test')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {preTestQuestions.map(renderQuestionEditor)}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Post-test Questions */}
        <TabsContent value="posttest" className="space-y-6">
          {/* Page 1: Experience Assessment */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-900/50 border-blue-500 text-blue-300">Page 1</Badge>
                  Experience Assessment
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Likert scale questions about trust, engagement, and satisfaction (shown first)
                </CardDescription>
              </div>
              {permissions.canCreateQuestions && (
                <Select onValueChange={(category) => addNewQuestion('post_test', category, 'likert')}>
                  <SelectTrigger className="w-[180px] bg-blue-600 border-0 text-white hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    <span>Add Question</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expectations">Expectations</SelectItem>
                    <SelectItem value="avatar-qualities">Avatar Qualities</SelectItem>
                    <SelectItem value="realism">Realism</SelectItem>
                    <SelectItem value="trust">Trust Category</SelectItem>
                    <SelectItem value="engagement">Engagement Category</SelectItem>
                    <SelectItem value="satisfaction">Satisfaction Category</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {postTestQuestions
                  .filter(q => ['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'].includes(q.category || ''))
                  .map(renderQuestionEditor)}
              </Accordion>
              {postTestQuestions.filter(q => ['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'].includes(q.category || '')).length === 0 && (
                <p className="text-slate-500 text-center py-4">No experience questions. Add one above.</p>
              )}
            </CardContent>
          </Card>

          {/* Page 2: Knowledge Assessment */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-900/50 border-purple-500 text-purple-300">Page 2</Badge>
                  Knowledge Assessment
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Multiple choice knowledge check questions (shown after experience questions)
                </CardDescription>
              </div>
              {permissions.canCreateQuestions && (
                <Button 
                  onClick={() => addNewQuestion('post_test', 'knowledge', 'multiple-choice')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {postTestQuestions
                  .filter(q => q.category === 'knowledge')
                  .map(renderQuestionEditor)}
              </Accordion>
              {postTestQuestions.filter(q => q.category === 'knowledge').length === 0 && (
                <p className="text-slate-500 text-center py-4">No knowledge questions. Add one above.</p>
              )}
            </CardContent>
          </Card>

          {/* Page 3: Open Feedback */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-900/50 border-green-500 text-green-300">Page 3</Badge>
                  Open Feedback
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Open-ended questions for qualitative feedback (optional for participants)
                </CardDescription>
              </div>
              {permissions.canCreateQuestions && (
                <Button 
                  onClick={() => addNewQuestion('post_test', 'open_feedback', 'open-text')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {postTestQuestions
                  .filter(q => q.category === 'open_feedback')
                  .map(renderQuestionEditor)}
              </Accordion>
              {postTestQuestions.filter(q => q.category === 'open_feedback').length === 0 && (
                <p className="text-slate-500 text-center py-4">No open feedback questions. Add one above.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics */}
        <TabsContent value="demographics" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Demographic Questions</CardTitle>
                <CardDescription className="text-slate-400">
                  Questions about participant demographics
                </CardDescription>
              </div>
              {permissions.canCreateQuestions && (
                <Button 
                  onClick={() => addNewQuestion('demographic')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {demographicQuestions.map(renderQuestionEditor)}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminQuestions;
