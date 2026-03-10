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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      adjustments: {
        Row: {
          amount: number
          budget_id: string
          created_at: string | null
          id: string
          label: string
          sign: number
        }
        Insert: {
          amount?: number
          budget_id: string
          created_at?: string | null
          id?: string
          label?: string
          sign?: number
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string | null
          id?: string
          label?: string
          sign?: number
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          bairro: string | null
          client_name: string
          condominio: string | null
          consultora_comercial: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          disclaimer: string | null
          email_comercial: string | null
          floor_plan_url: string | null
          generated_at: string | null
          id: string
          last_viewed_at: string | null
          lead_email: string | null
          lead_name: string | null
          metragem: string | null
          notes: string | null
          project_name: string
          public_id: string | null
          public_token_hash: string | null
          show_item_prices: boolean | null
          show_item_qty: boolean | null
          show_progress_bars: boolean | null
          status: string
          unit: string | null
          updated_at: string | null
          validity_days: number | null
          versao: string | null
          view_count: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          client_name?: string
          condominio?: string | null
          consultora_comercial?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          disclaimer?: string | null
          email_comercial?: string | null
          floor_plan_url?: string | null
          generated_at?: string | null
          id?: string
          last_viewed_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          metragem?: string | null
          notes?: string | null
          project_name?: string
          public_id?: string | null
          public_token_hash?: string | null
          show_item_prices?: boolean | null
          show_item_qty?: boolean | null
          show_progress_bars?: boolean | null
          status?: string
          unit?: string | null
          updated_at?: string | null
          validity_days?: number | null
          versao?: string | null
          view_count?: number
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          client_name?: string
          condominio?: string | null
          consultora_comercial?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          disclaimer?: string | null
          email_comercial?: string | null
          floor_plan_url?: string | null
          generated_at?: string | null
          id?: string
          last_viewed_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          metragem?: string | null
          notes?: string | null
          project_name?: string
          public_id?: string | null
          public_token_hash?: string | null
          show_item_prices?: boolean | null
          show_item_qty?: boolean | null
          show_progress_bars?: boolean | null
          status?: string
          unit?: string | null
          updated_at?: string | null
          validity_days?: number | null
          versao?: string | null
          view_count?: number
        }
        Relationships: []
      }
      item_images: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          item_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          item_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          item_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          coverage_type: string
          created_at: string | null
          description: string | null
          excluded_rooms: Json
          id: string
          included_rooms: Json
          internal_total: number | null
          internal_unit_price: number | null
          order_index: number
          qty: number | null
          section_id: string
          title: string
          unit: string | null
        }
        Insert: {
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          excluded_rooms?: Json
          id?: string
          included_rooms?: Json
          internal_total?: number | null
          internal_unit_price?: number | null
          order_index?: number
          qty?: number | null
          section_id: string
          title?: string
          unit?: string | null
        }
        Update: {
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          excluded_rooms?: Json
          id?: string
          included_rooms?: Json
          internal_total?: number | null
          internal_unit_price?: number | null
          order_index?: number
          qty?: number | null
          section_id?: string
          title?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string | null
          created_by: string | null
          filename: string | null
          folder: string | null
          id: string
          tags: Json | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          filename?: string | null
          folder?: string | null
          id?: string
          tags?: Json | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          filename?: string | null
          folder?: string | null
          id?: string
          tags?: Json | null
          url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          budget_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          budget_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          budget_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          budget_id: string
          created_at: string | null
          id: string
          name: string
          order_index: number
          polygon: Json
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          polygon?: Json
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          polygon?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rooms_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          budget_id: string
          cover_image_url: string | null
          created_at: string | null
          excluded_bullets: Json | null
          id: string
          included_bullets: Json | null
          notes: string | null
          order_index: number
          qty: number | null
          section_price: number | null
          subtitle: string | null
          tags: Json | null
          title: string
        }
        Insert: {
          budget_id: string
          cover_image_url?: string | null
          created_at?: string | null
          excluded_bullets?: Json | null
          id?: string
          included_bullets?: Json | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          section_price?: number | null
          subtitle?: string | null
          tags?: Json | null
          title?: string
        }
        Update: {
          budget_id?: string
          cover_image_url?: string | null
          created_at?: string | null
          excluded_bullets?: Json | null
          id?: string
          included_bullets?: Json | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          section_price?: number | null
          subtitle?: string | null
          tags?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
