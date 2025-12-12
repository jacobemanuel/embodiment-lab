import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswers?: string[]; // Changed to array for multiple correct answers
  category?: string;
  type?: string;
  allowMultiple?: boolean; // Flag to indicate if multiple answers are allowed
}

export const useStudyQuestions = (questionType: 'pre_test' | 'post_test' | 'demographic', includeCorrectAnswers: boolean = false) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Always fetch all columns but only expose correct_answer when explicitly requested
        const { data, error } = await supabase
          .from('study_questions')
          .select('question_id, question_text, options, question_meta, category, is_active, sort_order, correct_answer')
          .eq('question_type', questionType)
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;

        // Transform database format to component format
        const transformedQuestions: Question[] = (data || []).map((q) => {
          // Parse question_meta if it exists to get the type
          const meta = q.question_meta as Record<string, Json> | null;
          const questionTypeFromMeta = meta?.type as string | undefined;
          
          // Parse correct_answer - only expose if includeCorrectAnswers is true
          let correctAnswers: string[] | undefined;
          if (includeCorrectAnswers && q.correct_answer) {
            correctAnswers = q.correct_answer.split('|||').map((a: string) => a.trim()).filter(Boolean);
          }
          
          // Check if question has multiple correct answers (for UI hint)
          const hasMultipleCorrect = q.correct_answer ? q.correct_answer.includes('|||') : false;
          
          return {
            id: q.question_id,
            text: q.question_text,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correctAnswers, // Only populated if includeCorrectAnswers is true
            category: q.category || undefined,
            type: questionTypeFromMeta || 'multiple-choice',
            allowMultiple: hasMultipleCorrect, // Hint for UI that multiple selections are possible
          };
        });

        setQuestions(transformedQuestions);
      } catch (err) {
        console.error(`Error fetching ${questionType} questions:`, err);
        setError(err instanceof Error ? err : new Error(`Failed to fetch ${questionType} questions`));
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [questionType, includeCorrectAnswers]);

  return { questions, isLoading, error };
};
