export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_assistant_settings: {
        Row: {
          assistant_id: string
          created_at: string | null
          id: number
          is_active: boolean | null
          model: string
          name: string
          subject_id: string
          thread_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          model: string
          name: string
          subject_id: string
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          model?: string
          name?: string
          subject_id?: string
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_settings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          has_generated_content: boolean | null
          id: string
          role: string
          subject_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          has_generated_content?: boolean | null
          id: string
          role: string
          subject_id: string
          timestamp: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          has_generated_content?: boolean | null
          id?: string
          role?: string
          subject_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          subject_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subject_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_feed: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          order_index: number
          subject_id: string
          timestamp: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id: string
          order_index: number
          subject_id: string
          timestamp: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          order_index?: number
          subject_id?: string
          timestamp?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_feed_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          id: string
          name: string
          slug: string
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_by?: string
          created_at?: string | null
        }
        Relationships: []
      }
      school_members: {
        Row: {
          id: string
          school_id: string
          user_id: string
          role: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          user_id: string
          role: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          user_id?: string
          role?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          id: string
          school_id: string
          title: string
          subject: string | null
          grade_level: string | null
          description: string | null
          join_code: string
          state: string
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          title: string
          subject?: string | null
          grade_level?: string | null
          description?: string | null
          join_code: string
          state?: string
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          title?: string
          subject?: string | null
          grade_level?: string | null
          description?: string | null
          join_code?: string
          state?: string
          created_by?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          id: string
          course_id: string
          name: string
          schedule_json: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          schedule_json?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          schedule_json?: Json | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          id: string
          section_id: string
          student_user_id: string
          status: string
          enrolled_at: string | null
        }
        Insert: {
          id?: string
          section_id: string
          student_user_id: string
          status?: string
          enrolled_at?: string | null
        }
        Update: {
          id?: string
          section_id?: string
          student_user_id?: string
          status?: string
          enrolled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          id: string
          course_id: string
          title: string
          position: number
          created_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          position?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          position?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          id: string
          lesson_id: string
          position: number
          blocks_json: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          lesson_id: string
          position?: number
          blocks_json?: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          lesson_id?: string
          position?: number
          blocks_json?: Json
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slides_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          id: string
          course_id: string
          lesson_id: string | null
          title: string
          due_at: string | null
          type: string
          created_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          lesson_id?: string | null
          title: string
          due_at?: string | null
          type: string
          created_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          lesson_id?: string | null
          title?: string
          due_at?: string | null
          type?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          id: string
          assignment_id: string
          student_user_id: string
          answers_json: Json
          grade: number | null
          feedback: string | null
          submitted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          assignment_id: string
          student_user_id: string
          answers_json?: Json
          grade?: number | null
          feedback?: string | null
          submitted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          assignment_id?: string
          student_user_id?: string
          answers_json?: Json
          grade?: number | null
          feedback?: string | null
          submitted_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          section_id: string
          date: string
          student_user_id: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          section_id: string
          date: string
          student_user_id: string
          status: string
          created_at?: string | null
        }
        Update: {
          id?: string
          section_id?: string
          date?: string
          student_user_id?: string
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          keywords: string[] | null
          last_active: string
          learning_progress: Json | null
          lesson_plan: Json | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id: string
          keywords?: string[] | null
          last_active: string
          learning_progress?: Json | null
          lesson_plan?: Json | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          last_active?: string
          learning_progress?: Json | null
          lesson_plan?: Json | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
