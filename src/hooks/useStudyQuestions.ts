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
        if (includeCorrectAnswers) {
          // Admin view - fetch from main table with correct_answer (requires researcher role)
          const { data, error } = await supabase
            .from('study_questions')
            .select('question_id, question_text, options, question_meta, category, is_active, sort_order, correct_answer')
            .eq('question_type', questionType)
            .eq('is_active', true)
            .order('sort_order');

          if (error) throw error;

          const transformedQuestions: Question[] = (data || []).map((q) => {
            const meta = q.question_meta as Record<string, Json> | null;
            const questionTypeFromMeta = meta?.type as string | undefined;
            
            let correctAnswers: string[] | undefined;
            if (q.correct_answer) {
              correctAnswers = q.correct_answer.split('|||').map((a: string) => a.trim()).filter(Boolean);
            }
            
            return {
              id: q.question_id,
              text: q.question_text,
              options: Array.isArray(q.options) ? (q.options as string[]) : [],
              correctAnswers,
              category: q.category || undefined,
              type: questionTypeFromMeta || 'multiple-choice',
              allowMultiple: q.correct_answer ? q.correct_answer.includes('|||') : false,
            };
          });

          setQuestions(transformedQuestions);
        } else {
          // Participant view - fetch from public view (no correct_answer exposed)
          const { data, error } = await supabase
            .from('study_questions_public' as any)
            .select('question_id, question_text, options, question_meta, category, allow_multiple')
            .eq('question_type', questionType)
            .order('sort_order');

          if (error) throw error;

          const transformedQuestions: Question[] = (data || []).map((q: any) => {
            const meta = q.question_meta as Record<string, Json> | null;
            const questionTypeFromMeta = meta?.type as string | undefined;
            
            return {
              id: q.question_id,
              text: q.question_text,
              options: Array.isArray(q.options) ? (q.options as string[]) : [],
              category: q.category || undefined,
              type: questionTypeFromMeta || 'multiple-choice',
              allowMultiple: q.allow_multiple || false,
            };
          });

          setQuestions(transformedQuestions);
        }
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
