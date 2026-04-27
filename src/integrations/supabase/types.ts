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
          unassigned_at: string | null
          unassigned_by: string | null
        }
        Insert: {
          accountant_id: string
          assigned_at?: string
          client_id: string
          id?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
        }
        Update: {
          accountant_id?: string
          assigned_at?: string
          client_id?: string
          id?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
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
          auto_renew: boolean | null
          base_client_count: number
          billing_day: number
          created_at: string
          email: string
          free_months: number
          id: string
          is_active: boolean | null
          monthly_fee: number | null
          name: string
          phone: string | null
          plan_expires_at: string | null
          plan_type: string | null
          price_per_client: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          base_client_count?: number
          billing_day?: number
          created_at?: string
          email: string
          free_months?: number
          id?: string
          is_active?: boolean | null
          monthly_fee?: number | null
          name: string
          phone?: string | null
          plan_expires_at?: string | null
          plan_type?: string | null
          price_per_client?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          base_client_count?: number
          billing_day?: number
          created_at?: string
          email?: string
          free_months?: number
          id?: string
          is_active?: boolean | null
          monthly_fee?: number | null
          name?: string
          phone?: string | null
          plan_expires_at?: string | null
          plan_type?: string | null
          price_per_client?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      billing_log: {
        Row: {
          base_amount: number
          base_count: number | null
          billing_day: number | null
          billing_period: string
          created_at: string
          entity_id: string
          entity_type: string
          external_payment_id: string | null
          extra_amount: number
          extra_count: number | null
          id: string
          invoice_pdf_url: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_url: string | null
          retry_count: number
          status: string
          total_before_vat: number
          total_with_vat: number
          vat_amount: number
        }
        Insert: {
          base_amount?: number
          base_count?: number | null
          billing_day?: number | null
          billing_period: string
          created_at?: string
          entity_id: string
          entity_type: string
          external_payment_id?: string | null
          extra_amount?: number
          extra_count?: number | null
          id?: string
          invoice_pdf_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_url?: string | null
          retry_count?: number
          status?: string
          total_before_vat?: number
          total_with_vat?: number
          vat_amount?: number
        }
        Update: {
          base_amount?: number
          base_count?: number | null
          billing_day?: number | null
          billing_period?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          external_payment_id?: string | null
          extra_amount?: number
          extra_count?: number | null
          id?: string
          invoice_pdf_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_url?: string | null
          retry_count?: number
          status?: string
          total_before_vat?: number
          total_with_vat?: number
          vat_amount?: number
        }
        Relationships: []
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          telegram_chat_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          telegram_chat_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          telegram_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          advanced_settings: Json | null
          ai_temperature: number
          alloc_threshold_after: number
          alloc_threshold_before: number
          billing_cycle: string
          billing_day: number
          brand_name: string
          business_nature: string | null
          created_at: string
          custom_categories: Json | null
          drive_folder_id: string | null
          extra_invoice_price: number | null
          fetch_domains: Json
          free_months: number
          gemini_api_key: string | null
          id: string
          invoice_limit_override: number | null
          invoice_platforms: Json
          is_active: boolean
          known_domains: Json
          learned_words: Json
          legal_name: string | null
          locked_monthly_price: number | null
          locked_yearly_price: number | null
          lookback_rows: number
          max_distance: number
          max_logo_bytes: number
          monthly_price: number
          owner_aliases: Json
          plan_expires_at: string | null
          plan_id: string | null
          plan_type: string
          processed_ids: Json
          script_id: string | null
          search_days: number
          tax_rules: Json
          telegram_chat_id: string | null
          thread_limit: number
          updated_at: string
          updated_by: string | null
          user_id: string | null
          vat_number: string | null
          vat_rate: number
          yearly_price: number
        }
        Insert: {
          advanced_settings?: Json | null
          ai_temperature?: number
          alloc_threshold_after?: number
          alloc_threshold_before?: number
          billing_cycle?: string
          billing_day?: number
          brand_name: string
          business_nature?: string | null
          created_at?: string
          custom_categories?: Json | null
          drive_folder_id?: string | null
          extra_invoice_price?: number | null
          fetch_domains?: Json
          free_months?: number
          gemini_api_key?: string | null
          id?: string
          invoice_limit_override?: number | null
          invoice_platforms?: Json
          is_active?: boolean
          known_domains?: Json
          learned_words?: Json
          legal_name?: string | null
          locked_monthly_price?: number | null
          locked_yearly_price?: number | null
          lookback_rows?: number
          max_distance?: number
          max_logo_bytes?: number
          monthly_price?: number
          owner_aliases?: Json
          plan_expires_at?: string | null
          plan_id?: string | null
          plan_type?: string
          processed_ids?: Json
          script_id?: string | null
          search_days?: number
          tax_rules?: Json
          telegram_chat_id?: string | null
          thread_limit?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vat_number?: string | null
          vat_rate?: number
          yearly_price?: number
        }
        Update: {
          advanced_settings?: Json | null
          ai_temperature?: number
          alloc_threshold_after?: number
          alloc_threshold_before?: number
          billing_cycle?: string
          billing_day?: number
          brand_name?: string
          business_nature?: string | null
          created_at?: string
          custom_categories?: Json | null
          drive_folder_id?: string | null
          extra_invoice_price?: number | null
          fetch_domains?: Json
          free_months?: number
          gemini_api_key?: string | null
          id?: string
          invoice_limit_override?: number | null
          invoice_platforms?: Json
          is_active?: boolean
          known_domains?: Json
          learned_words?: Json
          legal_name?: string | null
          locked_monthly_price?: number | null
          locked_yearly_price?: number | null
          lookback_rows?: number
          max_distance?: number
          max_logo_bytes?: number
          monthly_price?: number
          owner_aliases?: Json
          plan_expires_at?: string | null
          plan_id?: string | null
          plan_type?: string
          processed_ids?: Json
          script_id?: string | null
          search_days?: number
          tax_rules?: Json
          telegram_chat_id?: string | null
          thread_limit?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vat_number?: string | null
          vat_rate?: number
          yearly_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          is_read: boolean
          thread_status: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          email_message_id?: string | null
          id?: string
          invoice_id: string
          is_read?: boolean
          thread_status?: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          email_message_id?: string | null
          id?: string
          invoice_id?: string
          is_read?: boolean
          thread_status?: string
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
          archived_at: string | null
          archived_by: string | null
          category: string | null
          client_id: string
          created_at: string
          currency_note: string | null
          deleted_at: string | null
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
          updated_at: string
          updated_by: string | null
          vat_deductible: number | null
          vat_original: number | null
          vendor: string | null
        }
        Insert: {
          allocation_number?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          currency_note?: string | null
          deleted_at?: string | null
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
          updated_at?: string
          updated_by?: string | null
          vat_deductible?: number | null
          vat_original?: number | null
          vendor?: string | null
        }
        Update: {
          allocation_number?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          currency_note?: string | null
          deleted_at?: string | null
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
          updated_at?: string
          updated_by?: string | null
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
      plan_price_history: {
        Row: {
          apply_to_existing: boolean
          changed_at: string
          changed_by: string | null
          id: string
          monthly_price: number
          plan_id: string
          yearly_price: number
        }
        Insert: {
          apply_to_existing?: boolean
          changed_at?: string
          changed_by?: string | null
          id?: string
          monthly_price: number
          plan_id: string
          yearly_price: number
        }
        Update: {
          apply_to_existing?: boolean
          changed_at?: string
          changed_by?: string | null
          id?: string
          monthly_price?: number
          plan_id?: string
          yearly_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_price_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          invoice_limit: number
          is_active: boolean
          monthly_price: number
          name: string
          trial_days: number
          user_limit: number
          yearly_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_limit?: number
          is_active?: boolean
          monthly_price?: number
          name: string
          trial_days?: number
          user_limit?: number
          yearly_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_limit?: number
          is_active?: boolean
          monthly_price?: number
          name?: string
          trial_days?: number
          user_limit?: number
          yearly_price?: number
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
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
      vat_rules: {
        Row: {
          category: string
          no_vat: boolean
          tax_rate: number
          updated_at: string | null
          vat_rate: number
        }
        Insert: {
          category: string
          no_vat?: boolean
          tax_rate?: number
          updated_at?: string | null
          vat_rate?: number
        }
        Update: {
          category?: string
          no_vat?: boolean
          tax_rate?: number
          updated_at?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_active_assignments: {
        Row: {
          accountant_id: string | null
          assigned_at: string | null
          client_id: string | null
          id: string | null
          unassigned_at: string | null
          unassigned_by: string | null
        }
        Insert: {
          accountant_id?: string | null
          assigned_at?: string | null
          client_id?: string | null
          id?: string | null
          unassigned_at?: string | null
          unassigned_by?: string | null
        }
        Update: {
          accountant_id?: string | null
          assigned_at?: string | null
          client_id?: string | null
          id?: string | null
          unassigned_at?: string | null
          unassigned_by?: string | null
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
    }
    Functions: {
      delete_accountant_full: {
        Args: { p_accountant_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_of_accountant: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
