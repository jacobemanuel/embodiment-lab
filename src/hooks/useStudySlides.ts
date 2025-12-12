import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DatabaseSlide {
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

export interface Slide {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  keyPoints: string[];
  systemPromptContext: string;
}

export const useStudySlides = () => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const { data, error } = await supabase
          .from('study_slides')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;

        // Transform database format to component format
        const transformedSlides: Slide[] = (data || []).map((slide) => ({
          id: slide.slide_id,
          title: slide.title,
          content: slide.content,
          imageUrl: slide.image_url || undefined,
          keyPoints: Array.isArray(slide.key_points) ? (slide.key_points as string[]) : [],
          systemPromptContext: slide.system_prompt_context,
        }));

        setSlides(transformedSlides);
      } catch (err) {
        console.error('Error fetching slides:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch slides'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlides();
  }, []);

  return { slides, isLoading, error };
};
