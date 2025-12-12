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

export const useStudyQuestions = (questionType: 'pre_test' | 'post_test' | 'demographic') => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from('study_questions')
          .select('*')
          .eq('question_type', questionType)
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;

        // Transform database format to component format
        const transformedQuestions: Question[] = (data || []).map((q) => {
          // Parse question_meta if it exists to get the type
          const meta = q.question_meta as Record<string, Json> | null;
          const questionTypeFromMeta = meta?.type as string | undefined;
          
          // Parse correct_answer - can be single string or comma-separated for multiple
          let correctAnswers: string[] | undefined;
          if (q.correct_answer) {
            // Check if it's a comma-separated list (for multiple correct answers)
            correctAnswers = q.correct_answer.split('|||').map(a => a.trim()).filter(Boolean);
          }
          
          return {
            id: q.question_id,
            text: q.question_text,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correctAnswers,
            category: q.category || undefined,
            type: questionTypeFromMeta || 'multiple-choice',
            allowMultiple: correctAnswers && correctAnswers.length > 1,
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
  }, [questionType]);

  return { questions, isLoading, error };
};
