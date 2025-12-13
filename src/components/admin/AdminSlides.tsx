import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { 
  Save, Edit2, XCircle, CheckCircle, RefreshCw, Plus, Trash2, 
  HelpCircle, Eye, EyeOff, GripVertical, Brain, BookOpen, Lock, AlertTriangle
} from "lucide-react";
import { logAdminAction, computeChanges } from "@/lib/auditLog";
import { getPermissions } from "@/lib/permissions";

interface StudySlide {
  id: string;
  slide_id: string;
  title: string;
  content: string;
  image_url: string | null;
  key_points: string[];
  system_prompt_context: string;
  sort_order: number;
  is_active: boolean;
}

interface AdminSlidesProps {
  userEmail: string;
}

const AdminSlides = ({ userEmail }: AdminSlidesProps) => {
  const permissions = getPermissions(userEmail);
  const [slides, setSlides] = useState<StudySlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<StudySlide>>({});

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('study_slides')
        .select('*')
        .order('sort_order');

      if (error) throw error;

      const parsed = data?.map(s => ({
        ...s,
        key_points: Array.isArray(s.key_points) ? s.key_points.map(String) : []
      })) as StudySlide[] || [];

      setSlides(parsed);
    } catch (error) {
      console.error('Error fetching slides:', error);
      toast.error('Failed to load slides');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  const startEditing = (slide: StudySlide) => {
    setEditingSlide(slide.id);
    setEditedData({
      title: slide.title,
      content: slide.content,
      image_url: slide.image_url,
      key_points: [...slide.key_points],
      system_prompt_context: slide.system_prompt_context,
    });
  };

  const cancelEditing = () => {
    setEditingSlide(null);
    setEditedData({});
  };

  const saveSlide = async (slideId: string) => {
    setIsSaving(true);
    try {
      // Find original slide for change tracking
      const originalSlide = slides.find(s => s.id === slideId);
      
      const { error } = await supabase
        .from('study_slides')
        .update({
          title: editedData.title,
          content: editedData.content,
          image_url: editedData.image_url,
          key_points: editedData.key_points,
          system_prompt_context: editedData.system_prompt_context,
        })
        .eq('id', slideId);

      if (error) throw error;

      // Log the change
      if (originalSlide) {
        const changes = computeChanges(
          originalSlide,
          editedData as Record<string, any>,
          ['title', 'content', 'image_url', 'key_points', 'system_prompt_context']
        );
        await logAdminAction({
          actionType: 'update',
          entityType: 'slide',
          entityId: originalSlide.slide_id,
          entityName: editedData.title || originalSlide.title,
          changes,
        });
      }

      toast.success('Slide saved! Changes are now live on the platform.');
      setEditingSlide(null);
      setEditedData({});
      fetchSlides();
    } catch (error) {
      console.error('Error saving slide:', error);
      toast.error('Failed to save slide');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSlideActive = async (slide: StudySlide) => {
    try {
      const { error } = await supabase
        .from('study_slides')
        .update({ is_active: !slide.is_active })
        .eq('id', slide.id);

      if (error) throw error;

      // Log the change
      await logAdminAction({
        actionType: 'update',
        entityType: 'slide',
        entityId: slide.slide_id,
        entityName: slide.title,
        changes: { is_active: { old: slide.is_active, new: !slide.is_active } },
      });

      toast.success(slide.is_active ? 'Slide hidden from users' : 'Slide visible to users');
      fetchSlides();
    } catch (error) {
      console.error('Error toggling slide:', error);
      toast.error('Failed to update slide');
    }
  };

  const addKeyPoint = () => {
    if (!editedData.key_points) return;
    setEditedData({
      ...editedData,
      key_points: [...editedData.key_points, 'New key point'],
    });
  };

  const removeKeyPoint = (index: number) => {
    if (!editedData.key_points) return;
    setEditedData({
      ...editedData,
      key_points: editedData.key_points.filter((_, i) => i !== index),
    });
  };

  const updateKeyPoint = (index: number, value: string) => {
    if (!editedData.key_points) return;
    const newPoints = [...editedData.key_points];
    newPoints[index] = value;
    setEditedData({
      ...editedData,
      key_points: newPoints,
    });
  };

  const addNewSlide = async () => {
    const maxOrder = slides.reduce((max, s) => Math.max(max, s.sort_order), 0);
    const newSlideId = `slide-${Date.now()}`;

    try {
      const { error } = await supabase
        .from('study_slides')
        .insert({
          slide_id: newSlideId,
          title: 'New Slide',
          content: 'Add your slide content here...',
          key_points: ['Key point 1', 'Key point 2'],
          system_prompt_context: 'Describe this slide topic for the AI tutor...',
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;

      // Log the action
      await logAdminAction({
        actionType: 'create',
        entityType: 'slide',
        entityId: newSlideId,
        entityName: 'New Slide',
      });

      toast.success('New slide added');
      fetchSlides();
    } catch (error) {
      console.error('Error adding slide:', error);
      toast.error('Failed to add slide');
    }
  };

  const deleteSlide = async (slideId: string) => {
    if (!permissions.canDeleteSlides) {
      toast.error('You do not have permission to delete slides. You can hide them instead.');
      return;
    }
    if (!confirm('Are you sure you want to delete this slide? This cannot be undone.')) return;

    const slideToDelete = slides.find(s => s.id === slideId);

    try {
      const { error } = await supabase
        .from('study_slides')
        .delete()
        .eq('id', slideId);

      if (error) throw error;

      // Log the action
      if (slideToDelete) {
        await logAdminAction({
          actionType: 'delete',
          entityType: 'slide',
          entityId: slideToDelete.slide_id,
          entityName: slideToDelete.title,
        });
      }

      toast.success('Slide deleted');
      fetchSlides();
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Failed to delete slide');
    }
  };

  const HelpTooltip = ({ content }: { content: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-4 h-4 text-slate-400 cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-700 text-slate-100 border-slate-600">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderSlideEditor = (slide: StudySlide) => {
    const isEditing = editingSlide === slide.id;
    const data = isEditing ? editedData : slide;
    const slideNumber = slides.findIndex((s) => s.id === slide.id) + 1;

    return (
      <AccordionItem 
        key={slide.id} 
        value={slide.id}
        className={`border rounded-lg px-4 ${slide.is_active ? 'border-slate-700' : 'border-orange-900/50 bg-orange-900/10'}`}
      >
        <AccordionTrigger className="text-white hover:no-underline">
          <div className="flex items-center gap-3 flex-1">
            <GripVertical className="w-4 h-4 text-slate-500" />
            <Badge variant="outline" className="text-xs font-mono">
              #{slideNumber}
            </Badge>
            <span className={`text-left flex-1 ${!slide.is_active ? 'text-orange-400' : ''}`}>
              {slide.title}
            </span>
            {!slide.is_active && (
              <Badge variant="outline" className="text-xs border-orange-600 text-orange-400">
                Hidden
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-6 pt-4">
          {/* Title */}
          <div>
            <div className="flex items-center">
              <Label className="text-slate-300">Slide Title</Label>
              <HelpTooltip content="The main heading displayed at the top of the slide" />
            </div>
            <Input
              value={isEditing ? data.title : slide.title}
              onChange={(e) => isEditing && setEditedData({ ...editedData, title: e.target.value })}
              className="mt-1 bg-slate-900 border-slate-600"
              disabled={!isEditing}
            />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Label className="text-slate-300">
                  <BookOpen className="w-4 h-4 inline mr-1" />
                  Slide Content
                </Label>
                <HelpTooltip content="The main educational content shown to users. Use Markdown formatting for better presentation." />
              </div>
            </div>
            
            {/* Markdown formatting tips */}
            {isEditing && (
              <div className="mt-2 mb-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Formatting Tips:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span><code className="text-blue-400">## Title</code> → Section header</span>
                  <span><code className="text-blue-400">- item</code> → Bullet point</span>
                  <span><code className="text-blue-400">1. item</code> → Numbered list</span>
                  <span><code className="text-blue-400">**bold**</code> → Bold text</span>
                  <span><code className="text-blue-400">`code`</code> → Inline code</span>
                  <span><code className="text-blue-400">A {'->'} B</code> → Flow diagram</span>
                  <span><code className="text-blue-400">| Col1 | Col2 |</code> → Table</span>
                  <span><code className="text-blue-400">"quote"</code> → Highlighted</span>
                </div>
              </div>
            )}
            
            <Textarea
              value={isEditing ? data.content : slide.content}
              onChange={(e) => isEditing && setEditedData({ ...editedData, content: e.target.value })}
              className="mt-1 bg-slate-900 border-slate-600 min-h-[200px] font-mono text-sm"
              disabled={!isEditing}
            />
          </div>

          {/* Key Points */}
          <div>
            <div className="flex items-center">
              <Label className="text-slate-300">Key Points</Label>
              <HelpTooltip content="Bullet points summarizing the main concepts. These are displayed prominently on the slide." />
            </div>
            <div className="space-y-2 mt-2">
              {(isEditing ? data.key_points || [] : slide.key_points).map((point, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm w-6">•</span>
                  <Input
                    value={point}
                    onChange={(e) => isEditing && updateKeyPoint(index, e.target.value)}
                    className="bg-slate-900 border-slate-600"
                    disabled={!isEditing}
                  />
                  {isEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeKeyPoint(index)}
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
                  onClick={addKeyPoint}
                  className="border-slate-600 mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Key Point
                </Button>
              )}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <div className="flex items-center">
              <Label className="text-slate-300">Image URL (optional)</Label>
              <HelpTooltip content="Full URL to an image to display on this slide. Leave empty for no image." />
            </div>
            <Input
              value={isEditing ? data.image_url || '' : slide.image_url || ''}
              onChange={(e) => isEditing && setEditedData({ ...editedData, image_url: e.target.value || null })}
              className="mt-1 bg-slate-900 border-slate-600"
              placeholder="https://example.com/image.jpg"
              disabled={!isEditing}
            />
          </div>

          {/* AI Context - IMPORTANT */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Brain className="w-5 h-5 text-blue-400 mr-2" />
              <Label className="text-blue-300 font-medium">AI Tutor Context</Label>
              <HelpTooltip content="CRITICAL: This text is sent to the AI tutor (avatar/chat) so it knows what this slide is about. The AI uses this to answer questions accurately. Be detailed and specific!" />
            </div>
            <p className="text-blue-300/70 text-xs mb-3">
              This context tells the AI tutor what this slide covers. The AI will use this information to answer user questions accurately.
            </p>
            <Textarea
              value={isEditing ? data.system_prompt_context : slide.system_prompt_context}
              onChange={(e) => isEditing && setEditedData({ ...editedData, system_prompt_context: e.target.value })}
              className="bg-slate-900 border-blue-700/50 min-h-[150px] text-sm"
              placeholder="Describe this slide's topic in detail. Include key concepts, definitions, examples, and common misconceptions the AI should know about..."
              disabled={!isEditing}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
            {isEditing ? (
              <>
                <Button
                  onClick={() => saveSlide(slide.id)}
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
                {permissions.canEditSlides ? (
                  <Button
                    onClick={() => startEditing(slide)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Slide
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
                {permissions.canHideSlides && (
                  <Button
                    variant="outline"
                    onClick={() => toggleSlideActive(slide)}
                    className={slide.is_active ? 'border-orange-600 text-orange-400' : 'border-green-600 text-green-400'}
                  >
                    {slide.is_active ? (
                      <><EyeOff className="w-4 h-4 mr-2" /> Hide</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" /> Show</>
                    )}
                  </Button>
                )}
                {permissions.canDeleteSlides ? (
                  <Button
                    variant="ghost"
                    onClick={() => deleteSlide(slide.id)}
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
                        <p className="text-sm">Deleting slides is restricted to the owner. You can hide slides instead.</p>
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

  return (
    <div className="space-y-6">
      {/* Help Card */}
      <Card className="bg-blue-900/20 border-blue-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-blue-200 font-medium">Learning Slides Editor</p>
              <p className="text-blue-300/70 text-sm mt-1">
                Edit the educational slides shown during the learning phase. The <strong>"AI Tutor Context"</strong> field 
                is especially important - it tells the AI avatar/chat what each slide covers so it can answer questions accurately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slide Visual Style Info */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-slate-200 font-medium">Slide Presentation Style</p>
              <p className="text-slate-400 text-sm mt-1">
                Slides are displayed with a distinctive <strong className="text-cyan-400">presentation-style background</strong> that 
                visually separates them from the rest of the page. Each slide has corner accents, a gradient header, 
                and an elevated shadow effect to create a PowerPoint-like feel. Content uses Markdown formatting 
                (headers, lists, tables, code blocks) which is automatically styled for best presentation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Learning Slides ({slides.length})</CardTitle>
            <CardDescription className="text-slate-400">
              Manage the slide content shown to participants
            </CardDescription>
          </div>
          {permissions.canCreateSlides && (
            <Button 
              onClick={addNewSlide}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Slide
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {slides.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No slides yet. Click "Add Slide" to create your first slide.</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {slides.map(renderSlideEditor)}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSlides;
