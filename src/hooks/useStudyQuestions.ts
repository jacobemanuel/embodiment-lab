import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
}

interface DatabaseQuestion {
  id: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_answer: string | null;
  category: string | null;
  question_type: string;
  is_active: boolean;
  sort_order: number;
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
        const transformedQuestions: Question[] = (data || []).map((q) => ({
          id: q.question_id,
          text: q.question_text,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          correctAnswer: q.correct_answer || undefined,
          category: q.category || undefined,
        }));

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
