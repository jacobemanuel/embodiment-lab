export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_email: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action_type: string
          admin_email: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action_type?: string
          admin_email?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      avatar_time_tracking: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          session_id: string
          slide_id: string
          slide_title: string
          started_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_id: string
          slide_id: string
          slide_title: string
          started_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_id?: string
          slide_id?: string
          slide_title?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_time_tracking_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      demographic_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          session_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          session_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demographic_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      demographics: {
        Row: {
          age_range: string | null
          created_at: string
          digital_experience: string | null
          education: string | null
          id: string
          session_id: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          digital_experience?: string | null
          education?: string | null
          id?: string
          session_id: string
        }
        Update: {
          age_range?: string | null
          created_at?: string
          digital_experience?: string | null
          education?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demographics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dialogue_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          scenario_id: string
          timestamp: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          scenario_id: string
          timestamp?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          scenario_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogue_turns_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      post_test_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          session_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          session_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_test_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_test_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          session_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          session_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_test_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_change_requests: {
        Row: {
          change_type: string
          id: string
          proposed_changes: Json
          question_id: string | null
          requested_at: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          change_type: string
          id?: string
          proposed_changes: Json
          question_id?: string | null
          requested_at?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          change_type?: string
          id?: string
          proposed_changes?: Json
          question_id?: string | null
          requested_at?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_change_requests_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "study_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_change_requests_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "study_questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          completed_at: string
          confidence_rating: number
          created_at: string
          engagement_rating: boolean
          generated_images: Json | null
          id: string
          scenario_id: string
          session_id: string
          trust_rating: number
        }
        Insert: {
          completed_at?: string
          confidence_rating: number
          created_at?: string
          engagement_rating: boolean
          generated_images?: Json | null
          id?: string
          scenario_id: string
          session_id: string
          trust_rating: number
        }
        Update: {
          completed_at?: string
          confidence_rating?: number
          created_at?: string
          engagement_rating?: boolean
          generated_images?: Json | null
          id?: string
          scenario_id?: string
          session_id?: string
          trust_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_questions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          correct_answer: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          mode_specific: string | null
          options: Json
          pending_changes: Json | null
          question_id: string
          question_meta: Json | null
          question_text: string
          question_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          correct_answer?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mode_specific?: string | null
          options?: Json
          pending_changes?: Json | null
          question_id: string
          question_meta?: Json | null
          question_text: string
          question_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          correct_answer?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mode_specific?: string | null
          options?: Json
          pending_changes?: Json | null
          question_id?: string
          question_meta?: Json | null
          question_text?: string
          question_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          browser_fingerprint: string | null
          completed_at: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          mode: Database["public"]["Enums"]["study_mode"]
          modes_used: string[] | null
          session_id: string
          started_at: string
          status: string
          suspicion_score: number | null
          suspicious_flags: Json | null
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          browser_fingerprint?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          mode: Database["public"]["Enums"]["study_mode"]
          modes_used?: string[] | null
          session_id: string
          started_at?: string
          status?: string
          suspicion_score?: number | null
          suspicious_flags?: Json | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          browser_fingerprint?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          mode?: Database["public"]["Enums"]["study_mode"]
          modes_used?: string[] | null
          session_id?: string
          started_at?: string
          status?: string
          suspicion_score?: number | null
          suspicious_flags?: Json | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      study_slides: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          key_points: Json
          slide_id: string
          sort_order: number
          system_prompt_context: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          key_points?: Json
          slide_id: string
          sort_order?: number
          system_prompt_context: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          key_points?: Json
          slide_id?: string
          sort_order?: number
          system_prompt_context?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutor_dialogue_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["study_mode"]
          role: string
          session_id: string
          slide_id: string | null
          slide_title: string | null
          timestamp: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mode: Database["public"]["Enums"]["study_mode"]
          role: string
          session_id: string
          slide_id?: string | null
          slide_title?: string | null
          timestamp?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["study_mode"]
          role?: string
          session_id?: string
          slide_id?: string | null
          slide_title?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_dialogue_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      study_questions_public: {
        Row: {
          allow_multiple: boolean | null
          category: string | null
          id: string | null
          is_active: boolean | null
          options: Json | null
          question_id: string | null
          question_meta: Json | null
          question_text: string | null
          question_type: string | null
          sort_order: number | null
        }
        Insert: {
          allow_multiple?: never
          category?: string | null
          id?: string | null
          is_active?: boolean | null
          options?: Json | null
          question_id?: string | null
          question_meta?: Json | null
          question_text?: string | null
          question_type?: string | null
          sort_order?: number | null
        }
        Update: {
          allow_multiple?: never
          category?: string | null
          id?: string | null
          is_active?: boolean | null
          options?: Json | null
          question_id?: string | null
          question_meta?: Json | null
          question_text?: string | null
          question_type?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "researcher"
      study_mode: "text" | "voice" | "avatar"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "researcher"],
      study_mode: ["text", "voice", "avatar"],
    },
  },
} as const
