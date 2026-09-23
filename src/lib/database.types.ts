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
    PostgrestVersion: "14.5"
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      calendar_events: {
        Row: {
          category: string
          created_at: string
          date: string
          end_time: string | null
          household_id: string
          id: string
          is_cancelled: boolean
          note: string | null
          person: string
          recurring_template_id: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          end_time?: string | null
          household_id: string
          id?: string
          is_cancelled?: boolean
          note?: string | null
          person: string
          recurring_template_id?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          end_time?: string | null
          household_id?: string
          id?: string
          is_cancelled?: boolean
          note?: string | null
          person?: string
          recurring_template_id?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          created_at: string
          hourly_rate: number
          household_id: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hourly_rate: number
          household_id: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hourly_rate?: number
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label: string
          slug?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          francesca_activity: string | null
          household_id: string
          id: string
          label: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          francesca_activity?: string | null
          household_id: string
          id?: string
          label?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          francesca_activity?: string | null
          household_id?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_fkey"
            columns: ["household_id", "category"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["household_id", "slug"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      note_section_recovery: {
        Row: {
          household_id: string
          recovery_key_hex: string
          section_id: string
          updated_at: string
        }
        Insert: {
          household_id: string
          recovery_key_hex: string
          section_id: string
          updated_at?: string
        }
        Update: {
          household_id?: string
          recovery_key_hex?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_section_recovery_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_section_recovery_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "note_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      note_sections: {
        Row: {
          created_at: string
          encryption_canary: string | null
          encryption_salt: string | null
          encryption_wrapped_key: string | null
          household_id: string
          id: string
          sort_order: number
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          encryption_canary?: string | null
          encryption_salt?: string | null
          encryption_wrapped_key?: string | null
          household_id: string
          id?: string
          sort_order?: number
          title: string
          type: string
        }
        Update: {
          created_at?: string
          encryption_canary?: string | null
          encryption_salt?: string | null
          encryption_wrapped_key?: string | null
          household_id?: string
          id?: string
          sort_order?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_sections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          content_encrypted: string | null
          created_at: string
          household_id: string
          id: string
          section_id: string
          title: string
        }
        Insert: {
          content?: string | null
          content_encrypted?: string | null
          created_at?: string
          household_id: string
          id?: string
          section_id: string
          title: string
        }
        Update: {
          content?: string | null
          content_encrypted?: string | null
          created_at?: string
          household_id?: string
          id?: string
          section_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "note_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          date: string
          household_id: string
          id: string
          note: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          date: string
          household_id: string
          id?: string
          note?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_templates: {
        Row: {
          category: string
          created_at: string
          end_time: string | null
          household_id: string
          id: string
          note: string | null
          person: string
          start_time: string | null
          title: string
          weekday: number
        }
        Insert: {
          category: string
          created_at?: string
          end_time?: string | null
          household_id: string
          id?: string
          note?: string | null
          person: string
          start_time?: string | null
          title: string
          weekday: number
        }
        Update: {
          category?: string
          created_at?: string
          end_time?: string | null
          household_id?: string
          id?: string
          note?: string | null
          person?: string
          start_time?: string | null
          title?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_templates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          amount_due: number | null
          client_id: string
          created_at: string
          date: string
          end_time: string | null
          hours: number
          household_id: string
          id: string
          note: string | null
          rate_snapshot: number
          start_time: string | null
        }
        Insert: {
          amount_due?: number | null
          client_id: string
          created_at?: string
          date: string
          end_time?: string | null
          hours: number
          household_id: string
          id?: string
          note?: string | null
          rate_snapshot: number
          start_time?: string | null
        }
        Update: {
          amount_due?: number | null
          client_id?: string
          created_at?: string
          date?: string
          end_time?: string | null
          hours?: number
          household_id?: string
          id?: string
          note?: string | null
          rate_snapshot?: number
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      work_session_status: {
        Row: {
          amount_due: number | null
          client_id: string | null
          created_at: string | null
          cumulative_due: number | null
          date: string | null
          end_time: string | null
          hours: number | null
          household_id: string | null
          id: string | null
          note: string | null
          rate_snapshot: number | null
          start_time: string | null
          status: string | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_household: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_code: { Args: never; Returns: string }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      join_household: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
