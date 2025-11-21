import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Image as ImageIcon, AlertCircle, Settings2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
interface ImagePlaygroundProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}
interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: number;
}
const PlaygroundContent = () => {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const {
    toast
  } = useToast();

  // Advanced settings
  const [cfgScale, setCfgScale] = useState([7]);
  const [steps, setSteps] = useState([30]);
  const [seed, setSeed] = useState("");
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const examplePrompts = ["Sunset over mountains, photorealistic", "Futuristic city, cyberpunk, neon lights", "Cute robot with cat, digital art", "Abstract geometric shapes, vibrant colors"];
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt to generate an image",
        variant: "destructive"
      });
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          cfgScale: cfgScale[0],
          steps: steps[0],
          seed: seed ? parseInt(seed) : undefined,
          width,
          height
        }
      });
      if (error) {
        console.error('Generation error:', error);
        if (error.message?.includes('Rate limit')) {
          toast({
            title: "Rate limit exceeded",
            description: "Please wait a moment before generating another image",
            variant: "destructive"
          });
        } else if (error.message?.includes('Payment required')) {
          toast({
            title: "Credits required",
            description: "Please add credits to continue generating images",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Generation failed",
            description: error.message || "Failed to generate image. Please try again.",
            variant: "destructive"
          });
        }
        return;
      }
      if (!data?.imageUrl) {
        throw new Error('No image URL in response');
      }
      const newImage: GeneratedImage = {
        id: Math.random().toString(36).substring(7),
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        timestamp: Date.now()
      };
      setGeneratedImages(prev => [newImage, ...prev].slice(0, 5));
      toast({
        title: "Image generated!",
        description: "Your AI-generated image is ready"
      });
      setPrompt("");
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  return <div className="space-y-4">
      {/* Quick Examples */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2.5">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
          <Label className="text-sm font-semibold text-foreground">Quick Start Examples</Label>
          <span className="text-xs text-muted-foreground italic">(click to use)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {examplePrompts.map((example, index) => <Button key={index} variant="outline" size="sm" onClick={() => setPrompt(example)} className="text-xs h-auto py-2 px-2 justify-start text-left bg-background hover:bg-accent">
              {example}
            </Button>)}
        </div>
      </div>

      {/* Separator */}
      <div className="relative py-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t-2 border-primary/20" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 py-1 text-sm font-semibold border border-primary/30 rounded-full shadow-sm text-slate-600">
            Your Prompt
          </span>
        </div>
      </div>

      {/* Main Prompt */}
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-sm">Prompt</Label>
        <Textarea id="prompt" placeholder="Describe your image..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[80px] resize-none text-sm" maxLength={1000} />
        <p className="text-xs text-muted-foreground">{prompt.length}/1000</p>
      </div>

      {/* Negative Prompt */}
      <div className="space-y-2">
        <Label htmlFor="negativePrompt" className="text-sm">Negative Prompt</Label>
        <Textarea id="negativePrompt" placeholder="What to avoid (e.g., blurry, low quality)..." value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} className="min-h-[50px] resize-none text-sm" maxLength={500} />
      </div>

      {/* Advanced Settings - Collapsible */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-all">
            <span className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Advanced Settings</span>
              <span className="text-xs text-muted-foreground">({showAdvanced ? "expanded" : "more options"})</span>
            </span>
            <span className="text-xs text-primary">
              {showAdvanced ? "▲" : "▼"}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* CFG Scale */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-sm">CFG Scale (Prompt Guidance)</Label>
              <span className="text-sm font-medium">{cfgScale[0]}</span>
            </div>
            <Slider value={cfgScale} onValueChange={setCfgScale} min={1} max={20} step={0.5} className="py-4" />
            <p className="text-xs text-muted-foreground">Higher = follows prompt more closely (7-12 recommended)</p>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-sm">Steps</Label>
              <span className="text-sm font-medium">{steps[0]}</span>
            </div>
            <Slider value={steps} onValueChange={setSteps} min={10} max={50} step={5} className="py-4" />
            <p className="text-xs text-muted-foreground">More steps = higher quality, slower generation</p>
          </div>

          {/* Seed */}
          <div className="space-y-2">
            <Label htmlFor="seed" className="text-sm">Seed (for reproducibility)</Label>
            <Input id="seed" type="number" placeholder="Random (leave empty)" value={seed} onChange={e => setSeed(e.target.value)} className="text-sm" />
            <p className="text-xs text-muted-foreground">Same seed = same result with same prompt</p>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="width" className="text-sm">Width</Label>
              <Input id="width" type="number" value={width} onChange={e => setWidth(Math.max(256, Math.min(1024, parseInt(e.target.value) || 512)))} min={256} max={1024} step={64} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height" className="text-sm">Height</Label>
              <Input id="height" type="number" value={height} onChange={e => setHeight(Math.max(256, Math.min(1024, parseInt(e.target.value) || 512)))} min={256} max={1024} step={64} className="text-sm" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="w-full gap-2" size="lg">
        {isGenerating ? <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </> : <>
            <Sparkles className="w-4 h-4" />
            Generate Image
          </>}
      </Button>

      {/* Info */}
      <Alert className="items-start">
        <AlertCircle className="h-4 w-4 mt-0.5" />
        <AlertDescription className="text-xs">
          Generation takes 10-30s. Be specific for best results!
        </AlertDescription>
      </Alert>

      {/* Generated Images */}
      {generatedImages.length > 0 && <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Recent</Label>
          <div className="space-y-3">
            {generatedImages.map(image => <div key={image.id} className="space-y-2 p-3 rounded-lg border border-border bg-card/50">
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                  <img src={image.imageUrl} alt={image.prompt} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {image.prompt}
                </p>
              </div>)}
          </div>
        </div>}

      {/* Empty State */}
      {generatedImages.length === 0 && !isGenerating && <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/20">
              <ImageIcon className="w-10 h-10 text-primary" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            No images yet. Try a prompt!
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Generate your first AI image above
          </p>
        </div>}
    </div>;
};
export const ImagePlayground = ({
  isOpen,
  onClose,
  embedded = false
}: ImagePlaygroundProps) => {
  if (embedded) {
    return <PlaygroundContent />;
  }
  return <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Image Playground
          </SheetTitle>
          <SheetDescription>
            Generate images while learning
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <PlaygroundContent />
        </div>
      </SheetContent>
    </Sheet>;
};