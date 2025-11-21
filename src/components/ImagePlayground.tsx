import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Image as ImageIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImagePlaygroundProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: number;
}

export const ImagePlayground = ({ isOpen, onClose }: ImagePlaygroundProps) => {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const { toast } = useToast();

  const examplePrompts = [
    "A serene landscape with mountains at sunset, photorealistic, detailed, 8k quality",
    "A futuristic city with flying cars, cyberpunk style, neon lights, highly detailed",
    "A cute robot playing with a cat in a cozy living room, digital art, warm lighting",
    "An abstract painting with vibrant colors, geometric shapes, modern art style"
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt to generate an image",
        variant: "destructive"
      });
      return;
    }

    if (prompt.length > 1000) {
      toast({
        title: "Prompt too long",
        description: "Please keep your prompt under 1000 characters",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { 
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined
        }
      });

      if (error) {
        console.error('Generation error:', error);
        
        // Check for specific error types
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

      setGeneratedImages(prev => [newImage, ...prev].slice(0, 5)); // Keep last 5 images
      
      toast({
        title: "Image generated!",
        description: "Your AI-generated image is ready",
      });

      // Clear prompt after successful generation
      setPrompt("");
      setNegativePrompt("");
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

  const useExamplePrompt = (example: string) => {
    setPrompt(example);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Image Playground
          </SheetTitle>
          <SheetDescription>
            Generate images while learning - practice what you're being taught!
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Example Prompts */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Examples</Label>
            <div className="grid grid-cols-1 gap-2">
              {examplePrompts.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => useExamplePrompt(example)}
                  className="text-left h-auto py-2 px-3 text-xs justify-start whitespace-normal"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          {/* Main Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Your Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the image you want to create... (e.g., 'a sunset over mountains, golden hour lighting, photorealistic')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">{prompt.length}/1000 characters</p>
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <Label htmlFor="negativePrompt">Negative Prompt (Optional)</Label>
            <Textarea
              id="negativePrompt"
              placeholder="What to avoid... (e.g., 'blurry, low quality, distorted')"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="min-h-[60px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">Tell the AI what NOT to include</p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Image
              </>
            )}
          </Button>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Generation takes 10-30 seconds. The AI follows your prompt closely - be specific for best results!
            </AlertDescription>
          </Alert>

          {/* Generated Images History */}
          {generatedImages.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Recently Generated</Label>
              <div className="space-y-4">
                {generatedImages.map((image) => (
                  <div key={image.id} className="space-y-2 p-4 rounded-lg border border-border bg-card/50">
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                      <img
                        src={image.imageUrl}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {image.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {generatedImages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                No images generated yet.<br />
                Try entering a prompt above!
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
