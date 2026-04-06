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
      budget_comments: {
        Row: {
          body: string
          budget_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          budget_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          budget_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_events: {
        Row: {
          budget_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json | null
          note: string | null
          to_status: string | null
          user_id: string | null
        }
        Insert: {
          budget_id: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status?: string | null
          user_id?: string | null
        }
        Update: {
          budget_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budget_optional_selections: {
        Row: {
          budget_id: string
          client_email: string | null
          client_name: string | null
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          id: string
          section_id: string
        }
        Insert: {
          budget_id: string
          client_email?: string | null
          client_name?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          section_id: string
        }
        Update: {
          budget_id?: string
          client_email?: string | null
          client_name?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_optional_selections_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_optional_selections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_template_items: {
        Row: {
          bdi_percentage: number | null
          coverage_type: string
          created_at: string | null
          description: string | null
          id: string
          internal_total: number | null
          internal_unit_price: number | null
          order_index: number
          qty: number | null
          reference_url: string | null
          template_section_id: string
          title: string
          unit: string | null
        }
        Insert: {
          bdi_percentage?: number | null
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          internal_total?: number | null
          internal_unit_price?: number | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
          template_section_id: string
          title?: string
          unit?: string | null
        }
        Update: {
          bdi_percentage?: number | null
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          internal_total?: number | null
          internal_unit_price?: number | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
          template_section_id?: string
          title?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_template_items_template_section_id_fkey"
            columns: ["template_section_id"]
            isOneToOne: false
            referencedRelation: "budget_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_template_sections: {
        Row: {
          created_at: string | null
          excluded_bullets: Json | null
          id: string
          included_bullets: Json | null
          is_optional: boolean
          notes: string | null
          order_index: number
          subtitle: string | null
          tags: Json | null
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          excluded_bullets?: Json | null
          id?: string
          included_bullets?: Json | null
          is_optional?: boolean
          notes?: string | null
          order_index?: number
          subtitle?: string | null
          tags?: Json | null
          template_id: string
          title?: string
        }
        Update: {
          created_at?: string | null
          excluded_bullets?: Json | null
          id?: string
          included_bullets?: Json | null
          is_optional?: boolean
          notes?: string | null
          order_index?: number
          subtitle?: string | null
          tags?: Json | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      budget_tours: {
        Row: {
          budget_id: string
          created_at: string | null
          id: string
          order_index: number
          room_id: string
          room_label: string
          tour_url: string
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          id?: string
          order_index?: number
          room_id: string
          room_label: string
          tour_url: string
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          id?: string
          order_index?: number
          room_id?: string
          room_label?: string
          tour_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_tours_budget_id_fkey"
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
          briefing: string | null
          change_reason: string | null
          city: string | null
          client_name: string
          client_phone: string | null
          closed_at: string | null
          commercial_owner_id: string | null
          condominio: string | null
          consultora_comercial: string | null
          contract_file_url: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          demand_context: string | null
          disclaimer: string | null
          due_at: string | null
          email_comercial: string | null
          estimated_weeks: number | null
          estimator_owner_id: string | null
          floor_plan_url: string | null
          generated_at: string | null
          header_config: Json | null
          hubspot_deal_url: string | null
          id: string
          internal_cost: number | null
          internal_notes: string | null
          internal_status: string
          is_current_version: boolean | null
          is_published_version: boolean | null
          last_viewed_at: string | null
          lead_email: string | null
          lead_name: string | null
          location_type: string | null
          metragem: string | null
          notes: string | null
          parent_budget_id: string | null
          prazo_dias_uteis: number | null
          priority: string
          project_name: string
          property_type: string | null
          public_id: string | null
          public_token_hash: string | null
          reference_links: Json | null
          sequential_code: string | null
          show_item_prices: boolean | null
          show_item_qty: boolean | null
          show_optional_items: boolean
          show_progress_bars: boolean | null
          status: string
          unit: string | null
          updated_at: string | null
          validity_days: number | null
          versao: string | null
          version_group_id: string | null
          version_number: number | null
          view_count: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          briefing?: string | null
          change_reason?: string | null
          city?: string | null
          client_name?: string
          client_phone?: string | null
          closed_at?: string | null
          commercial_owner_id?: string | null
          condominio?: string | null
          consultora_comercial?: string | null
          contract_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          demand_context?: string | null
          disclaimer?: string | null
          due_at?: string | null
          email_comercial?: string | null
          estimated_weeks?: number | null
          estimator_owner_id?: string | null
          floor_plan_url?: string | null
          generated_at?: string | null
          header_config?: Json | null
          hubspot_deal_url?: string | null
          id?: string
          internal_cost?: number | null
          internal_notes?: string | null
          internal_status?: string
          is_current_version?: boolean | null
          is_published_version?: boolean | null
          last_viewed_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          location_type?: string | null
          metragem?: string | null
          notes?: string | null
          parent_budget_id?: string | null
          prazo_dias_uteis?: number | null
          priority?: string
          project_name?: string
          property_type?: string | null
          public_id?: string | null
          public_token_hash?: string | null
          reference_links?: Json | null
          sequential_code?: string | null
          show_item_prices?: boolean | null
          show_item_qty?: boolean | null
          show_optional_items?: boolean
          show_progress_bars?: boolean | null
          status?: string
          unit?: string | null
          updated_at?: string | null
          validity_days?: number | null
          versao?: string | null
          version_group_id?: string | null
          version_number?: number | null
          view_count?: number
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          briefing?: string | null
          change_reason?: string | null
          city?: string | null
          client_name?: string
          client_phone?: string | null
          closed_at?: string | null
          commercial_owner_id?: string | null
          condominio?: string | null
          consultora_comercial?: string | null
          contract_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          demand_context?: string | null
          disclaimer?: string | null
          due_at?: string | null
          email_comercial?: string | null
          estimated_weeks?: number | null
          estimator_owner_id?: string | null
          floor_plan_url?: string | null
          generated_at?: string | null
          header_config?: Json | null
          hubspot_deal_url?: string | null
          id?: string
          internal_cost?: number | null
          internal_notes?: string | null
          internal_status?: string
          is_current_version?: boolean | null
          is_published_version?: boolean | null
          last_viewed_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          location_type?: string | null
          metragem?: string | null
          notes?: string | null
          parent_budget_id?: string | null
          prazo_dias_uteis?: number | null
          priority?: string
          project_name?: string
          property_type?: string | null
          public_id?: string | null
          public_token_hash?: string | null
          reference_links?: Json | null
          sequential_code?: string | null
          show_item_prices?: boolean | null
          show_item_qty?: boolean | null
          show_optional_items?: boolean
          show_progress_bars?: boolean | null
          status?: string
          unit?: string | null
          updated_at?: string | null
          validity_days?: number | null
          versao?: string | null
          version_group_id?: string | null
          version_number?: number | null
          view_count?: number
        }
        Relationships: []
      }
      catalog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      catalog_item_sections: {
        Row: {
          catalog_item_id: string
          created_at: string | null
          id: string
          section_title: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string | null
          id?: string
          section_title: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string | null
          id?: string
          section_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_sections_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_supplier_prices: {
        Row: {
          catalog_item_id: string
          created_at: string | null
          currency: string
          id: string
          is_active: boolean
          is_primary: boolean
          lead_time_days: number | null
          minimum_order_qty: number | null
          supplier_id: string
          supplier_sku: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          catalog_item_id: string
          created_at?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          lead_time_days?: number | null
          minimum_order_qty?: number | null
          supplier_id: string
          supplier_sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          catalog_item_id?: string
          created_at?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          lead_time_days?: number | null
          minimum_order_qty?: number | null
          supplier_id?: string
          supplier_sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_supplier_prices_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          default_supplier_id: string | null
          description: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_active: boolean
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          name: string
          search_text: string | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["catalog_item_type"]
          name?: string
          search_text?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["catalog_item_type"]
          name?: string
          search_text?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          attempts: number | null
          created_at: string | null
          entity_type: string
          error_message: string | null
          id: string
          payload: Json | null
          source_id: string
          source_system: string
          sync_status: string
          synced_at: string | null
          target_id: string | null
          target_system: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_id: string
          source_system: string
          sync_status?: string
          synced_at?: string | null
          target_id?: string | null
          target_system: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_id?: string
          source_system?: string
          sync_status?: string
          synced_at?: string | null
          target_id?: string | null
          target_system?: string
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
      item_photo_library: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          item_name: string
          item_name_normalized: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_name: string
          item_name_normalized: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_name?: string
          item_name_normalized?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          bdi_percentage: number | null
          catalog_item_id: string | null
          catalog_snapshot: Json | null
          coverage_type: string
          created_at: string | null
          description: string | null
          excluded_rooms: Json
          id: string
          included_rooms: Json
          internal_total: number | null
          internal_unit_price: number | null
          notes: string | null
          order_index: number
          qty: number | null
          reference_url: string | null
          section_id: string
          title: string
          unit: string | null
        }
        Insert: {
          bdi_percentage?: number | null
          catalog_item_id?: string | null
          catalog_snapshot?: Json | null
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          excluded_rooms?: Json
          id?: string
          included_rooms?: Json
          internal_total?: number | null
          internal_unit_price?: number | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
          section_id: string
          title?: string
          unit?: string | null
        }
        Update: {
          bdi_percentage?: number | null
          catalog_item_id?: string | null
          catalog_snapshot?: Json | null
          coverage_type?: string
          created_at?: string | null
          description?: string | null
          excluded_rooms?: Json
          id?: string
          included_rooms?: Json
          internal_total?: number | null
          internal_unit_price?: number | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
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
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string | null
        }
        Relationships: []
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
          is_optional: boolean
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
          is_optional?: boolean
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
          is_optional?: boolean
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
      suppliers: {
        Row: {
          categoria: string | null
          cidade: string | null
          cnpj_cpf: string | null
          condicoes_pagamento: string | null
          contact_info: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          external_id: string | null
          external_system: string | null
          id: string
          is_active: boolean
          name: string
          nota: number | null
          observacoes: string | null
          prazo_entrega_dias: number | null
          produtos_servicos: string | null
          razao_social: string | null
          site: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          condicoes_pagamento?: string | null
          contact_info?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nota?: number | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          produtos_servicos?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          condicoes_pagamento?: string | null
          contact_info?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nota?: number | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          produtos_servicos?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_access_budget: {
        Args: { _budget_id: string; _user_id: string }
        Returns: boolean
      }
      get_public_budget: { Args: { p_public_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: {
        Args: { p_public_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "orcamentista"
      catalog_item_type: "product" | "service"
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
      app_role: ["admin", "comercial", "orcamentista"],
      catalog_item_type: ["product", "service"],
    },
  },
} as const
