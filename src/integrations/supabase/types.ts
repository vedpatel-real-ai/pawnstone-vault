export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          meta: Json | null
          org_id: string
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
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
          alt_phone: string | null
          created_at: string | null
          email: string | null
          id: string
          id_proof_number: string | null
          id_proof_url: string | null
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          profile_photo_url: string | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_url?: string | null
          name: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          profile_photo_url?: string | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          profile_photo_url?: string | null
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
          loan_id: string
          org_id: string
          paid_amount: number
          status: Database["public"]["Enums"]["due_status"]
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          due_type: string
          id?: string
          loan_id: string
          org_id?: string
          paid_amount?: number
          status?: Database["public"]["Enums"]["due_status"]
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          due_type?: string
          id?: string
          loan_id?: string
          org_id?: string
          paid_amount?: number
          status?: Database["public"]["Enums"]["due_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_org_id_loan_id_fkey"
            columns: ["org_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      loan_assets: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          loan_id: string
          org_id: string
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          loan_id: string
          org_id?: string
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          loan_id?: string
          org_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_assets_org_id_loan_id_fkey"
            columns: ["org_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      loans: {
        Row: {
          asset_description: string | null
          asset_type: string | null
          asset_value: number | null
          created_at: string | null
          customer_id: string
          due_date: string | null
          id: string
          interest_rate_percent: number
          last_interest_calculated: string | null
          loan_amount: number
          next_due_date: string
          notes: string | null
          org_id: string
          remaining_principal: number
          start_date: string
          status: Database["public"]["Enums"]["loan_status"]
          term_months: number | null
          updated_at: string | null
        }
        Insert: {
          asset_description?: string | null
          asset_type?: string | null
          asset_value?: number | null
          created_at?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          interest_rate_percent: number
          last_interest_calculated?: string | null
          loan_amount: number
          next_due_date: string
          notes?: string | null
          org_id?: string
          remaining_principal: number
          start_date: string
          status?: Database["public"]["Enums"]["loan_status"]
          term_months?: number | null
          updated_at?: string | null
        }
        Update: {
          asset_description?: string | null
          asset_type?: string | null
          asset_value?: number | null
          created_at?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          interest_rate_percent?: number
          last_interest_calculated?: string | null
          loan_amount?: number
          next_due_date?: string
          notes?: string | null
          org_id?: string
          remaining_principal?: number
          start_date?: string
          status?: Database["public"]["Enums"]["loan_status"]
          term_months?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_org_id_customer_id_fkey"
            columns: ["org_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["org_id", "id"]
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
          due_id: string | null
          id: string
          loan_id: string | null
          mail_attempted_at: string | null
          mail_state: string | null
          org_id: string
          read: boolean | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          due_id?: string | null
          id?: string
          loan_id?: string | null
          mail_attempted_at?: string | null
          mail_state?: string | null
          org_id?: string
          read?: boolean | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          due_id?: string | null
          id?: string
          loan_id?: string | null
          mail_attempted_at?: string | null
          mail_state?: string | null
          org_id?: string
          read?: boolean | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_due_id_fkey"
            columns: ["due_id"]
            isOneToOne: true
            referencedRelation: "dues"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "notifications_org_id_loan_id_fkey"
            columns: ["org_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["org_id", "id"]
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
          loan_id: string
          notes: string | null
          org_id: string
          payment_date: string
          posted_by: string | null
          request_id: string | null
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          org_id?: string
          payment_date?: string
          posted_by?: string | null
          request_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          org_id?: string
          payment_date?: string
          posted_by?: string | null
          request_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_loan_id_fkey"
            columns: ["org_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["org_id", "id"]
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
      claim_due_mail: {
        Args: never
        Returns: {
          message: string
          notice_id: string
          recipient: string
        }[]
      }
      create_org_for_current_user: {
        Args: { p_name?: string }
        Returns: string
      }
      current_user_org_id: { Args: never; Returns: string }
      generate_scheduled_dues: { Args: never; Returns: number }
      post_payment: {
        Args: {
          p_amount: number
          p_loan: string
          p_notes?: string
          p_request: string
          p_type: Database["public"]["Enums"]["payment_type"]
        }
        Returns: {
          amount: number
          created_at: string | null
          id: string
          loan_id: string
          notes: string | null
          org_id: string
          payment_date: string
          posted_by: string | null
          request_id: string | null
          type: Database["public"]["Enums"]["payment_type"]
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      due_status: "pending" | "paid" | "overdue" | "cancelled"
      loan_status: "active" | "overdue" | "closed" | "defaulted"
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
      loan_status: ["active", "overdue", "closed", "defaulted"],
      payment_type: ["interest", "principal", "other"],
    },
  },
} as const
