import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, AlertCircle, Edit2 } from "lucide-react";
import { preTestQuestions, demographicQuestions, Question } from "@/data/questions";
import { postTestQuestions, PostTestQuestion } from "@/data/postTestQuestions";
import { slides, Slide } from "@/data/slides";

const AdminQuestions = () => {
  const [preTest, setPreTest] = useState<Question[]>([...preTestQuestions]);
  const [postTest, setPostTest] = useState<PostTestQuestion[]>([...postTestQuestions]);
  const [demo, setDemo] = useState<Question[]>([...demographicQuestions]);
  const [slideData, setSlideData] = useState<Slide[]>([...slides]);
  const [hasChanges, setHasChanges] = useState(false);

  const updatePreTestQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...preTest];
    updated[index] = { ...updated[index], [field]: value };
    setPreTest(updated);
    setHasChanges(true);
  };

  const updatePreTestOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...preTest];
    const options = [...updated[qIndex].options];
    options[oIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    setPreTest(updated);
    setHasChanges(true);
  };

  const addPreTestOption = (qIndex: number) => {
    const updated = [...preTest];
    updated[qIndex].options.push("Nowa opcja");
    setPreTest(updated);
    setHasChanges(true);
  };

  const removePreTestOption = (qIndex: number, oIndex: number) => {
    const updated = [...preTest];
    updated[qIndex].options.splice(oIndex, 1);
    setPreTest(updated);
    setHasChanges(true);
  };

  const updateSlide = (index: number, field: keyof Slide, value: any) => {
    const updated = [...slideData];
    updated[index] = { ...updated[index], [field]: value };
    setSlideData(updated);
    setHasChanges(true);
  };

  const updateSlideKeyPoint = (slideIndex: number, pointIndex: number, value: string) => {
    const updated = [...slideData];
    const keyPoints = [...updated[slideIndex].keyPoints];
    keyPoints[pointIndex] = value;
    updated[slideIndex] = { ...updated[slideIndex], keyPoints };
    setSlideData(updated);
    setHasChanges(true);
  };

  const generateExportCode = () => {
    const preTestCode = `export const preTestQuestions: Question[] = ${JSON.stringify(preTest, null, 2)};`;
    const demoCode = `export const demographicQuestions: Question[] = ${JSON.stringify(demo, null, 2)};`;
    const slidesCode = `export const slides: Slide[] = ${JSON.stringify(slideData, null, 2)};`;

    const fullCode = `// Updated questions.ts
${preTestCode}

${demoCode}

// Updated slides.ts
${slidesCode}`;

    navigator.clipboard.writeText(fullCode);
    toast.success("Kod skopiowany do schowka! Wklej go do odpowiednich plików.");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-yellow-900/20 border-yellow-700">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-medium">Edycja pytań</p>
              <p className="text-yellow-300/70 text-sm mt-1">
                Zmiany wprowadzone tutaj generują kod, który należy ręcznie wkleić do plików źródłowych 
                (questions.ts, postTestQuestions.ts, slides.ts). Po zapisaniu zmian, użyj przycisku 
                "Generuj kod" aby skopiować zaktualizowany kod.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={generateExportCode} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Generuj kod do wdrożenia
          </Button>
        </div>
      )}

      <Tabs defaultValue="pretest" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="pretest">Pre-test ({preTest.length})</TabsTrigger>
          <TabsTrigger value="demographics">Demografia ({demo.length})</TabsTrigger>
          <TabsTrigger value="slides">Slajdy ({slideData.length})</TabsTrigger>
        </TabsList>

        {/* Pre-test Questions */}
        <TabsContent value="pretest" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pytania Pre-test</CardTitle>
              <CardDescription className="text-slate-400">
                Edytuj pytania testowe wyświetlane przed nauką
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {preTest.map((question, qIndex) => (
                  <AccordionItem 
                    key={question.id} 
                    value={question.id}
                    className="border border-slate-700 rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-white hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">{question.id}</Badge>
                        <span className="text-left">{question.text.slice(0, 60)}...</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label className="text-slate-300">Treść pytania</Label>
                        <Textarea
                          value={question.text}
                          onChange={(e) => updatePreTestQuestion(qIndex, 'text', e.target.value)}
                          className="mt-1 bg-slate-900 border-slate-600"
                        />
                      </div>

                      <div>
                        <Label className="text-slate-300">Opcje odpowiedzi</Label>
                        <div className="space-y-2 mt-2">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <Input
                                value={option}
                                onChange={(e) => updatePreTestOption(qIndex, oIndex, e.target.value)}
                                className={`bg-slate-900 border-slate-600 ${option === question.correctAnswer ? 'border-green-500' : ''}`}
                              />
                              <Button
                                size="sm"
                                variant={option === question.correctAnswer ? "default" : "outline"}
                                onClick={() => updatePreTestQuestion(qIndex, 'correctAnswer', option)}
                                className={option === question.correctAnswer ? 'bg-green-600' : 'border-slate-600'}
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removePreTestOption(qIndex, oIndex)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addPreTestOption(qIndex)}
                            className="border-slate-600"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Dodaj opcję
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics */}
        <TabsContent value="demographics" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pytania demograficzne</CardTitle>
              <CardDescription className="text-slate-400">
                Edytuj pytania o dane demograficzne uczestników
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {demo.map((question, qIndex) => (
                  <AccordionItem 
                    key={question.id} 
                    value={question.id}
                    className="border border-slate-700 rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-white hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">{question.id}</Badge>
                        <span>{question.text}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label className="text-slate-300">Opcje</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {question.options.map((option, oIndex) => (
                            <Badge key={oIndex} variant="secondary" className="text-sm">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slides */}
        <TabsContent value="slides" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Slajdy edukacyjne</CardTitle>
              <CardDescription className="text-slate-400">
                Edytuj treść slajdów wyświetlanych podczas nauki
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {slideData.map((slide, sIndex) => (
                  <AccordionItem 
                    key={slide.id} 
                    value={slide.id}
                    className="border border-slate-700 rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-white hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">{sIndex + 1}</Badge>
                        <span>{slide.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label className="text-slate-300">Tytuł slajdu</Label>
                        <Input
                          value={slide.title}
                          onChange={(e) => updateSlide(sIndex, 'title', e.target.value)}
                          className="mt-1 bg-slate-900 border-slate-600"
                        />
                      </div>

                      <div>
                        <Label className="text-slate-300">Treść</Label>
                        <Textarea
                          value={slide.content}
                          onChange={(e) => updateSlide(sIndex, 'content', e.target.value)}
                          className="mt-1 bg-slate-900 border-slate-600 min-h-[200px] font-mono text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-slate-300">Kluczowe punkty</Label>
                        <div className="space-y-2 mt-2">
                          {slide.keyPoints.map((point, pIndex) => (
                            <Input
                              key={pIndex}
                              value={point}
                              onChange={(e) => updateSlideKeyPoint(sIndex, pIndex, e.target.value)}
                              className="bg-slate-900 border-slate-600"
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-slate-300">Kontekst dla AI</Label>
                        <Textarea
                          value={slide.systemPromptContext}
                          onChange={(e) => updateSlide(sIndex, 'systemPromptContext', e.target.value)}
                          className="mt-1 bg-slate-900 border-slate-600"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminQuestions;
