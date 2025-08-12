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
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          meta: Json | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          org_id: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          org_id?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dues: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          due_type: string
          id: string
          loan_id: string | null
          org_id: string | null
          status: Database["public"]["Enums"]["due_status"] | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          due_type: string
          id?: string
          loan_id?: string | null
          org_id?: string | null
          status?: Database["public"]["Enums"]["due_status"] | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          due_type?: string
          id?: string
          loan_id?: string | null
          org_id?: string | null
          status?: Database["public"]["Enums"]["due_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dues_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          asset_description: string | null
          asset_type: string | null
          asset_value: number | null
          created_at: string | null
          customer_id: string | null
          id: string
          interest_rate_percent: number
          last_interest_calculated: string | null
          loan_amount: number
          next_due_date: string
          org_id: string | null
          remaining_principal: number
          start_date: string
          status: Database["public"]["Enums"]["loan_status"] | null
          term_months: number | null
          updated_at: string | null
        }
        Insert: {
          asset_description?: string | null
          asset_type?: string | null
          asset_value?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          interest_rate_percent: number
          last_interest_calculated?: string | null
          loan_amount: number
          next_due_date: string
          org_id?: string | null
          remaining_principal: number
          start_date: string
          status?: Database["public"]["Enums"]["loan_status"] | null
          term_months?: number | null
          updated_at?: string | null
        }
        Update: {
          asset_description?: string | null
          asset_type?: string | null
          asset_value?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          interest_rate_percent?: number
          last_interest_calculated?: string | null
          loan_amount?: number
          next_due_date?: string
          org_id?: string | null
          remaining_principal?: number
          start_date?: string
          status?: Database["public"]["Enums"]["loan_status"] | null
          term_months?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          loan_id: string | null
          org_id: string | null
          read: boolean | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          loan_id?: string | null
          org_id?: string | null
          read?: boolean | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          loan_id?: string | null
          org_id?: string | null
          read?: boolean | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          loan_id: string | null
          notes: string | null
          org_id: string | null
          payment_date: string
          type: Database["public"]["Enums"]["payment_type"] | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          loan_id?: string | null
          notes?: string | null
          org_id?: string | null
          payment_date?: string
          type?: Database["public"]["Enums"]["payment_type"] | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          loan_id?: string | null
          notes?: string | null
          org_id?: string | null
          payment_date?: string
          type?: Database["public"]["Enums"]["payment_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          org_id: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          org_id?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _create_enforce_org_trigger: {
        Args: { _table: unknown }
        Returns: undefined
      }
      assign_user_to_org: {
        Args: { p_user_id: string; p_org_id: string }
        Returns: undefined
      }
      create_org_for_current_user: {
        Args: { p_name?: string }
        Returns: string
      }
      current_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      due_status: "pending" | "paid" | "overdue" | "cancelled"
      loan_status: "active" | "closed" | "defaulted"
      payment_type: "interest" | "principal" | "other"
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
      due_status: ["pending", "paid", "overdue", "cancelled"],
      loan_status: ["active", "closed", "defaulted"],
      payment_type: ["interest", "principal", "other"],
    },
  },
} as const
