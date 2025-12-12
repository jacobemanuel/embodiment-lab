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
import { toast } from "sonner";
import { Plus, Trash2, Save, CheckCircle, XCircle, RefreshCw, Edit2 } from "lucide-react";

interface StudyQuestion {
  id: string;
  question_type: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_answer: string | null;
  category: string | null;
  question_meta: Record<string, any>;
  sort_order: number;
  is_active: boolean;
}

const AdminQuestions = () => {
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

  const startEditing = (question: StudyQuestion) => {
    setEditingQuestion(question.id);
    setEditedData({
      question_text: question.question_text,
      options: [...question.options],
      correct_answer: question.correct_answer,
      category: question.category,
    });
  };

  const cancelEditing = () => {
    setEditingQuestion(null);
    setEditedData({});
  };

  const saveQuestion = async (questionId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('study_questions')
        .update({
          question_text: editedData.question_text,
          options: editedData.options,
          correct_answer: editedData.correct_answer,
          category: editedData.category,
        })
        .eq('id', questionId);

      if (error) throw error;

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
    const newOptions = editedData.options.filter((_, i) => i !== index);
    setEditedData({
      ...editedData,
      options: newOptions,
      // Clear correct answer if it was removed
      correct_answer: editedData.correct_answer === editedData.options[index] ? null : editedData.correct_answer,
    });
  };

  const updateOption = (index: number, value: string) => {
    if (!editedData.options) return;
    const newOptions = [...editedData.options];
    const oldValue = newOptions[index];
    newOptions[index] = value;
    setEditedData({
      ...editedData,
      options: newOptions,
      // Update correct answer if it was changed
      correct_answer: editedData.correct_answer === oldValue ? value : editedData.correct_answer,
    });
  };

  const addNewQuestion = async (questionType: string) => {
    const maxOrder = questions
      .filter(q => q.question_type === questionType)
      .reduce((max, q) => Math.max(max, q.sort_order), 0);

    const newQuestionId = `${questionType.replace('_', '-')}-${Date.now()}`;

    try {
      const { error } = await supabase
        .from('study_questions')
        .insert({
          question_type: questionType,
          question_id: newQuestionId,
          question_text: 'New question',
          options: ['Option 1', 'Option 2'],
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;

      toast.success('New question added');
      fetchQuestions();
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase
        .from('study_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

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

          {question.category && (
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

          <div>
            <Label className="text-slate-300">Answer Options</Label>
            <div className="space-y-2 mt-2">
              {(isEditing ? data.options || [] : question.options).map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => isEditing && updateOption(oIndex, e.target.value)}
                    className={`bg-slate-900 border-slate-600 ${
                      option === (isEditing ? data.correct_answer : question.correct_answer) ? 'border-green-500' : ''
                    }`}
                    disabled={!isEditing}
                  />
                  {question.correct_answer !== undefined && (
                    <Button
                      size="sm"
                      variant={option === (isEditing ? data.correct_answer : question.correct_answer) ? "default" : "outline"}
                      onClick={() => isEditing && setEditedData({ ...editedData, correct_answer: option })}
                      className={option === (isEditing ? data.correct_answer : question.correct_answer) ? 'bg-green-600' : 'border-slate-600'}
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
              ))}
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

          <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
            {isEditing ? (
              <>
                <Button
                  onClick={() => saveQuestion(question.id)}
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
                <Button
                  onClick={() => startEditing(question)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Question
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleQuestionActive(question)}
                  className={question.is_active ? 'border-yellow-600 text-yellow-400' : 'border-green-600 text-green-400'}
                >
                  {question.is_active ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => deleteQuestion(question.id)}
                  className="text-red-400 hover:text-red-300 ml-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
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
              <Button 
                onClick={() => addNewQuestion('pre_test')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {preTestQuestions.map(renderQuestionEditor)}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Post-test Questions */}
        <TabsContent value="posttest" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Post-test Questions</CardTitle>
                <CardDescription className="text-slate-400">
                  Questions shown after completing the learning phase (Likert scales and knowledge checks)
                </CardDescription>
              </div>
              <Button 
                onClick={() => addNewQuestion('post_test')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {postTestQuestions.map(renderQuestionEditor)}
              </Accordion>
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
              <Button 
                onClick={() => addNewQuestion('demographic')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
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
