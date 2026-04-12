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
  public: {
    Tables: {
      accountant_clients: {
        Row: {
          accountant_id: string
          assigned_at: string
          client_id: string
          id: string
        }
        Insert: {
          accountant_id: string
          assigned_at?: string
          client_id: string
          id?: string
        }
        Update: {
          accountant_id?: string
          assigned_at?: string
          client_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_clients_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "accountants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      accountants: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          advanced_settings: Json | null
          brand_name: string
          business_nature: string | null
          created_at: string
          custom_categories: Json | null
          drive_folder_id: string | null
          gemini_api_key: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          plan_expires_at: string | null
          plan_type: string
          script_id: string | null
          telegram_chat_id: string | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          advanced_settings?: Json | null
          brand_name: string
          business_nature?: string | null
          created_at?: string
          custom_categories?: Json | null
          drive_folder_id?: string | null
          gemini_api_key?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          plan_expires_at?: string | null
          plan_type?: string
          script_id?: string | null
          telegram_chat_id?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          advanced_settings?: Json | null
          brand_name?: string
          business_nature?: string | null
          created_at?: string
          custom_categories?: Json | null
          drive_folder_id?: string | null
          gemini_api_key?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          plan_expires_at?: string | null
          plan_type?: string
          script_id?: string | null
          telegram_chat_id?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      invoice_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          email_message_id: string | null
          id: string
          invoice_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          email_message_id?: string | null
          id?: string
          invoice_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          email_message_id?: string | null
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_comments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          allocation_number: string | null
          category: string | null
          client_id: string
          created_at: string
          currency_note: string | null
          document_type: string | null
          drive_file_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          is_archived: boolean
          payment_date: string | null
          status: string
          tax_deductible: number | null
          total: number | null
          vat_deductible: number | null
          vat_original: number | null
          vendor: string | null
        }
        Insert: {
          allocation_number?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          currency_note?: string | null
          document_type?: string | null
          drive_file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_archived?: boolean
          payment_date?: string | null
          status?: string
          tax_deductible?: number | null
          total?: number | null
          vat_deductible?: number | null
          vat_original?: number | null
          vendor?: string | null
        }
        Update: {
          allocation_number?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          currency_note?: string | null
          document_type?: string | null
          drive_file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_archived?: boolean
          payment_date?: string | null
          status?: string
          tax_deductible?: number | null
          total?: number | null
          vat_deductible?: number | null
          vat_original?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          client_id: string
          created_at: string
          from_accountant_id: string | null
          id: string
          invoice_id: string | null
          is_read: boolean
          message: string | null
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          from_accountant_id?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean
          message?: string | null
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string
          from_accountant_id?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean
          message?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_from_accountant_id_fkey"
            columns: ["from_accountant_id"]
            isOneToOne: false
            referencedRelation: "accountants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_log: {
        Row: {
          action: string
          client_id: string
          count: number
          created_at: string
          id: string
        }
        Insert: {
          action: string
          client_id: string
          count?: number
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          client_id?: string
          count?: number
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      [_ in never]: never
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
      app_role: "admin" | "accountant" | "client"
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
      app_role: ["admin", "accountant", "client"],
    },
  },
} as const
