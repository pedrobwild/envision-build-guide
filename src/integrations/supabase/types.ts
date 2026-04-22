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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_activities: {
        Row: {
          budget_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          outcome: string | null
          owner_id: string | null
          scheduled_for: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          budget_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          owner_id?: string | null
          scheduled_for?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          budget_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          owner_id?: string | null
          scheduled_for?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_activities_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_activities_budget_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "budget_comments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_comments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_conversation_messages: {
        Row: {
          attachments: Json
          author_name: string | null
          body: string | null
          conversation_id: string
          created_at: string
          direction: string | null
          external_id: string | null
          id: string
          message_type: string | null
          provider_data: Json
          reply_to_external_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          attachments?: Json
          author_name?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          direction?: string | null
          external_id?: string | null
          id?: string
          message_type?: string | null
          provider_data?: Json
          reply_to_external_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          attachments?: Json
          author_name?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string | null
          external_id?: string | null
          id?: string
          message_type?: string | null
          provider_data?: Json
          reply_to_external_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "budget_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_conversations: {
        Row: {
          assigned_user_name: string | null
          avatar_url: string | null
          budget_id: string
          channel: string | null
          contact_identifier: string | null
          contact_name: string | null
          created_at: string
          external_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          provider: string
          provider_data: Json
          status: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_user_name?: string | null
          avatar_url?: string | null
          budget_id: string
          channel?: string | null
          contact_identifier?: string | null
          contact_name?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          provider?: string
          provider_data?: Json
          status?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_user_name?: string | null
          avatar_url?: string | null
          budget_id?: string
          channel?: string | null
          contact_identifier?: string | null
          contact_name?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          provider?: string
          provider_data?: Json
          status?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_conversations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_conversations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "budget_events_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_events_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lost_reasons: {
        Row: {
          budget_id: string
          competitor_name: string | null
          competitor_value: number | null
          created_by: string | null
          id: string
          lost_at: string
          reason_category: string
          reason_detail: string | null
        }
        Insert: {
          budget_id: string
          competitor_name?: string | null
          competitor_value?: number | null
          created_by?: string | null
          id?: string
          lost_at?: string
          reason_category: string
          reason_detail?: string | null
        }
        Update: {
          budget_id?: string
          competitor_name?: string | null
          competitor_value?: number | null
          created_by?: string | null
          id?: string
          lost_at?: string
          reason_category?: string
          reason_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lost_reasons_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: true
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lost_reasons_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: true
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_meetings: {
        Row: {
          action_items: Json
          audio_url: string | null
          budget_id: string
          created_at: string
          duration_seconds: number | null
          external_id: string | null
          full_report: Json | null
          id: string
          next_steps: Json
          objections: Json
          participants: Json
          provider: string
          questions: Json
          started_at: string | null
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          action_items?: Json
          audio_url?: string | null
          budget_id: string
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          full_report?: Json | null
          id?: string
          next_steps?: Json
          objections?: Json
          participants?: Json
          provider?: string
          questions?: Json
          started_at?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          action_items?: Json
          audio_url?: string | null
          budget_id?: string
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          full_report?: Json | null
          id?: string
          next_steps?: Json
          objections?: Json
          participants?: Json
          provider?: string
          questions?: Json
          started_at?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_meetings_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_meetings_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
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
          media_config: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          media_config?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          media_config?: Json | null
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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
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
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          approved_at: string | null
          approved_by_name: string | null
          bairro: string | null
          briefing: string | null
          budget_pdf_url: string | null
          campaign_id: string | null
          campaign_name: string | null
          change_reason: string | null
          city: string | null
          client_id: string | null
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
          expected_close_at: string | null
          external_lead_id: string | null
          external_source: string | null
          floor_plan_url: string | null
          form_id: string | null
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
          lead_source: string | null
          location_type: string | null
          manual_total: number | null
          media_config: Json | null
          metragem: string | null
          notes: string | null
          parent_budget_id: string | null
          pipeline_id: string | null
          pipeline_stage: string | null
          prazo_dias_uteis: number | null
          priority: string
          project_name: string
          property_id: string | null
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
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          validity_days: number | null
          versao: string | null
          version_group_id: string | null
          version_number: number | null
          view_count: number
          win_probability: number | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          briefing?: string | null
          budget_pdf_url?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          change_reason?: string | null
          city?: string | null
          client_id?: string | null
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
          expected_close_at?: string | null
          external_lead_id?: string | null
          external_source?: string | null
          floor_plan_url?: string | null
          form_id?: string | null
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
          lead_source?: string | null
          location_type?: string | null
          manual_total?: number | null
          media_config?: Json | null
          metragem?: string | null
          notes?: string | null
          parent_budget_id?: string | null
          pipeline_id?: string | null
          pipeline_stage?: string | null
          prazo_dias_uteis?: number | null
          priority?: string
          project_name?: string
          property_id?: string | null
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
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          validity_days?: number | null
          versao?: string | null
          version_group_id?: string | null
          version_number?: number | null
          view_count?: number
          win_probability?: number | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          bairro?: string | null
          briefing?: string | null
          budget_pdf_url?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          change_reason?: string | null
          city?: string | null
          client_id?: string | null
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
          expected_close_at?: string | null
          external_lead_id?: string | null
          external_source?: string | null
          floor_plan_url?: string | null
          form_id?: string | null
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
          lead_source?: string | null
          location_type?: string | null
          manual_total?: number | null
          media_config?: Json | null
          metragem?: string | null
          notes?: string | null
          parent_budget_id?: string | null
          pipeline_id?: string | null
          pipeline_stage?: string | null
          prazo_dias_uteis?: number | null
          priority?: string
          project_name?: string
          property_id?: string | null
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
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          validity_days?: number | null
          versao?: string | null
          version_group_id?: string | null
          version_number?: number | null
          view_count?: number
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "client_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          category_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          category_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Update: {
          category_type?: string
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
      client_properties: {
        Row: {
          address: string | null
          address_complement: string | null
          bairro: string | null
          city: string | null
          client_id: string
          created_at: string
          created_by: string | null
          empreendimento: string | null
          floor_plan_url: string | null
          id: string
          is_primary: boolean
          label: string | null
          location_type: string | null
          metragem: string | null
          notes: string | null
          property_type: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          bairro?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          empreendimento?: string | null
          floor_plan_url?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          location_type?: string | null
          metragem?: string | null
          notes?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          bairro?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          empreendimento?: string | null
          floor_plan_url?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          location_type?: string | null
          metragem?: string | null
          notes?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          address: string | null
          address_complement: string | null
          adset_id: string | null
          adset_name: string | null
          bairro: string | null
          campaign_id: string | null
          campaign_name: string | null
          city: string | null
          commercial_owner_id: string | null
          condominio_default: string | null
          created_at: string
          created_by: string | null
          document: string | null
          document_type: string | null
          email: string | null
          external_lead_id: string | null
          external_lead_payload: Json | null
          external_source: string | null
          form_id: string | null
          form_name: string | null
          hubspot_contact_url: string | null
          id: string
          is_active: boolean
          location_type_default: string | null
          marital_status: string | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          phone_normalized: string | null
          profession: string | null
          property_address: string | null
          property_address_complement: string | null
          property_bairro: string | null
          property_city: string | null
          property_empreendimento: string | null
          property_floor_plan_url: string | null
          property_metragem: string | null
          property_state: string | null
          property_type_default: string | null
          property_zip_code: string | null
          referrer_name: string | null
          rg: string | null
          sequential_code: string | null
          source: string | null
          state: string | null
          status: string
          tags: string[]
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zip_code: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          address?: string | null
          address_complement?: string | null
          adset_id?: string | null
          adset_name?: string | null
          bairro?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          city?: string | null
          commercial_owner_id?: string | null
          condominio_default?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          external_lead_id?: string | null
          external_lead_payload?: Json | null
          external_source?: string | null
          form_id?: string | null
          form_name?: string | null
          hubspot_contact_url?: string | null
          id?: string
          is_active?: boolean
          location_type_default?: string | null
          marital_status?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          profession?: string | null
          property_address?: string | null
          property_address_complement?: string | null
          property_bairro?: string | null
          property_city?: string | null
          property_empreendimento?: string | null
          property_floor_plan_url?: string | null
          property_metragem?: string | null
          property_state?: string | null
          property_type_default?: string | null
          property_zip_code?: string | null
          referrer_name?: string | null
          rg?: string | null
          sequential_code?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          address?: string | null
          address_complement?: string | null
          adset_id?: string | null
          adset_name?: string | null
          bairro?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          city?: string | null
          commercial_owner_id?: string | null
          condominio_default?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          external_lead_id?: string | null
          external_lead_payload?: Json | null
          external_source?: string | null
          form_id?: string | null
          form_name?: string | null
          hubspot_contact_url?: string | null
          id?: string
          is_active?: boolean
          location_type_default?: string | null
          marital_status?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          profession?: string | null
          property_address?: string | null
          property_address_complement?: string | null
          property_bairro?: string | null
          property_city?: string | null
          property_empreendimento?: string | null
          property_floor_plan_url?: string | null
          property_metragem?: string | null
          property_state?: string | null
          property_type_default?: string | null
          property_zip_code?: string | null
          referrer_name?: string | null
          rg?: string | null
          sequential_code?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      commercial_targets: {
        Row: {
          created_at: string
          created_by: string | null
          deals_target: number
          id: string
          notes: string | null
          owner_id: string | null
          revenue_target_brl: number
          target_month: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deals_target?: number
          id?: string
          notes?: string | null
          owner_id?: string | null
          revenue_target_brl?: number
          target_month: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deals_target?: number
          id?: string
          notes?: string | null
          owner_id?: string | null
          revenue_target_brl?: number
          target_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_metrics_snapshot: {
        Row: {
          active_commercial: number
          active_estimators: number
          aging_buckets: Json
          avg_lead_time_days: number | null
          avg_ticket_brl: number | null
          avg_time_in_analysis_days: number | null
          avg_time_in_review_days: number | null
          avg_time_to_publish_days: number | null
          backlog_count: number
          closed_count: number
          commercial_funnel: Json
          conversion_rate_pct: number | null
          created_at: string
          delivered_to_sales_count: number
          generated_at: string
          gross_margin_pct: number | null
          health_diagnosis: string | null
          health_score: number | null
          id: string
          in_analysis_count: number
          median_lead_time_days: number | null
          operational_funnel: Json
          overdue_count: number
          portfolio_value_brl: number
          published_count: number
          received_count: number
          revenue_brl: number
          sla_at_risk_count: number
          sla_breach_48h_count: number
          sla_on_time_pct: number | null
          snapshot_date: string
          team_load_distribution: Json
          throughput_trend_pct: number | null
          weekly_throughput: number | null
        }
        Insert: {
          active_commercial?: number
          active_estimators?: number
          aging_buckets?: Json
          avg_lead_time_days?: number | null
          avg_ticket_brl?: number | null
          avg_time_in_analysis_days?: number | null
          avg_time_in_review_days?: number | null
          avg_time_to_publish_days?: number | null
          backlog_count?: number
          closed_count?: number
          commercial_funnel?: Json
          conversion_rate_pct?: number | null
          created_at?: string
          delivered_to_sales_count?: number
          generated_at?: string
          gross_margin_pct?: number | null
          health_diagnosis?: string | null
          health_score?: number | null
          id?: string
          in_analysis_count?: number
          median_lead_time_days?: number | null
          operational_funnel?: Json
          overdue_count?: number
          portfolio_value_brl?: number
          published_count?: number
          received_count?: number
          revenue_brl?: number
          sla_at_risk_count?: number
          sla_breach_48h_count?: number
          sla_on_time_pct?: number | null
          snapshot_date: string
          team_load_distribution?: Json
          throughput_trend_pct?: number | null
          weekly_throughput?: number | null
        }
        Update: {
          active_commercial?: number
          active_estimators?: number
          aging_buckets?: Json
          avg_lead_time_days?: number | null
          avg_ticket_brl?: number | null
          avg_time_in_analysis_days?: number | null
          avg_time_in_review_days?: number | null
          avg_time_to_publish_days?: number | null
          backlog_count?: number
          closed_count?: number
          commercial_funnel?: Json
          conversion_rate_pct?: number | null
          created_at?: string
          delivered_to_sales_count?: number
          generated_at?: string
          gross_margin_pct?: number | null
          health_diagnosis?: string | null
          health_score?: number | null
          id?: string
          in_analysis_count?: number
          median_lead_time_days?: number | null
          operational_funnel?: Json
          overdue_count?: number
          portfolio_value_brl?: number
          published_count?: number
          received_count?: number
          revenue_brl?: number
          sla_at_risk_count?: number
          sla_breach_48h_count?: number
          sla_on_time_pct?: number | null
          snapshot_date?: string
          team_load_distribution?: Json
          throughput_trend_pct?: number | null
          weekly_throughput?: number | null
        }
        Relationships: []
      }
      deal_pipelines: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      digisac_config: {
        Row: {
          api_base_url: string
          api_token: string | null
          created_at: string
          default_service_id: string | null
          default_user_id: string | null
          enabled: boolean
          id: string
          singleton: boolean
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_base_url?: string
          api_token?: string | null
          created_at?: string
          default_service_id?: string | null
          default_user_id?: string | null
          enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_base_url?: string
          api_token?: string | null
          created_at?: string
          default_service_id?: string | null
          default_user_id?: string | null
          enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      digisac_contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          external_id: string
          id: string
          last_seen_at: string | null
          name: string | null
          phone_normalized: string | null
          phone_raw: string | null
          provider_data: Json
          tags: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          external_id: string
          id?: string
          last_seen_at?: string | null
          name?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          provider_data?: Json
          tags?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          external_id?: string
          id?: string
          last_seen_at?: string | null
          name?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          provider_data?: Json
          tags?: Json
          updated_at?: string
        }
        Relationships: []
      }
      elephan_sync_state: {
        Row: {
          error_message: string | null
          id: string
          last_run_at: string
          last_synced_at: string | null
          meetings_matched: number
          meetings_pulled: number
          meetings_unmatched: number
          raw_sample: Json | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_run_at?: string
          last_synced_at?: string | null
          meetings_matched?: number
          meetings_pulled?: number
          meetings_unmatched?: number
          raw_sample?: Json | null
        }
        Update: {
          error_message?: string | null
          id?: string
          last_run_at?: string
          last_synced_at?: string | null
          meetings_matched?: number
          meetings_pulled?: number
          meetings_unmatched?: number
          raw_sample?: Json | null
        }
        Relationships: []
      }
      elephant_insights_cache: {
        Row: {
          cache_key: string
          charts_data: Json | null
          consultant_name: string | null
          created_at: string
          insights: Json | null
          latest_meeting: string | null
          positive_sentiment_pct: number | null
          total_duration_minutes: number | null
          total_meetings: number | null
          updated_at: string
        }
        Insert: {
          cache_key: string
          charts_data?: Json | null
          consultant_name?: string | null
          created_at?: string
          insights?: Json | null
          latest_meeting?: string | null
          positive_sentiment_pct?: number | null
          total_duration_minutes?: number | null
          total_meetings?: number | null
          updated_at?: string
        }
        Update: {
          cache_key?: string
          charts_data?: Json | null
          consultant_name?: string | null
          created_at?: string
          insights?: Json | null
          latest_meeting?: string | null
          positive_sentiment_pct?: number | null
          total_duration_minutes?: number | null
          total_meetings?: number | null
          updated_at?: string
        }
        Relationships: []
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
      lead_routing_rules: {
        Row: {
          assigned_owner_id: string | null
          assignment_strategy: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          match_campaign_id: string | null
          match_campaign_name_ilike: string | null
          match_city_ilike: string | null
          match_form_id: string | null
          match_source: string | null
          name: string
          priority: number
          round_robin_cursor: number
          round_robin_pool: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_owner_id?: string | null
          assignment_strategy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_campaign_id?: string | null
          match_campaign_name_ilike?: string | null
          match_city_ilike?: string | null
          match_form_id?: string | null
          match_source?: string | null
          name: string
          priority?: number
          round_robin_cursor?: number
          round_robin_pool?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_owner_id?: string | null
          assignment_strategy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_campaign_id?: string | null
          match_campaign_name_ilike?: string | null
          match_city_ilike?: string | null
          match_form_id?: string | null
          match_source?: string | null
          name?: string
          priority?: number
          round_robin_cursor?: number
          round_robin_pool?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          budget_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          client_id: string | null
          created_at: string
          external_id: string | null
          form_id: string | null
          form_name: string | null
          id: string
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          raw_payload: Json
          received_at: string
          source: string
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          budget_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          client_id?: string | null
          created_at?: string
          external_id?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          raw_payload?: Json
          received_at?: string
          source: string
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          budget_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          client_id?: string | null
          created_at?: string
          external_id?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          raw_payload?: Json
          received_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          metadata: Json
          metric_name: string | null
          metric_value: number | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          snapshot_date: string | null
          threshold_value: number | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          metric_name?: string | null
          metric_value?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          snapshot_date?: string | null
          threshold_value?: number | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          metric_name?: string | null
          metric_value?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          snapshot_date?: string | null
          threshold_value?: number | null
          title?: string
        }
        Relationships: []
      }
      operations_insights_history: {
        Row: {
          created_at: string
          executive_summary: string
          generated_at: string
          generated_by: string | null
          health_diagnosis: string
          health_score: number | null
          id: string
          insights: Json
          kpis_snapshot: Json
          period_days: number
          period_from: string
          period_to: string
        }
        Insert: {
          created_at?: string
          executive_summary: string
          generated_at?: string
          generated_by?: string | null
          health_diagnosis: string
          health_score?: number | null
          id?: string
          insights?: Json
          kpis_snapshot?: Json
          period_days: number
          period_from: string
          period_to: string
        }
        Update: {
          created_at?: string
          executive_summary?: string
          generated_at?: string
          generated_by?: string | null
          health_diagnosis?: string
          health_score?: number | null
          id?: string
          insights?: Json
          kpis_snapshot?: Json
          period_days?: number
          period_from?: string
          period_to?: string
        }
        Relationships: []
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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "budget_pipeline_view"
            referencedColumns: ["id"]
          },
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
      user_saved_views: {
        Row: {
          created_at: string
          entity: string
          filters: Json
          id: string
          is_default: boolean
          is_shared: boolean
          name: string
          sort: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name: string
          sort?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name?: string
          sort?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      budget_pipeline_view: {
        Row: {
          days_in_stage: number | null
          id: string | null
          pipeline_id: string | null
          pipeline_name: string | null
          pipeline_slug: string | null
          stage_entered_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stats: {
        Row: {
          active_budgets: number | null
          avg_ticket: number | null
          client_id: string | null
          last_budget_at: string | null
          latest_internal_status: string | null
          pipeline_value: number | null
          total_budgets: number | null
          total_won_value: number | null
          won_budgets: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_old_lead_payloads: { Args: never; Returns: number }
      budget_days_in_stage: { Args: { p_budget_id: string }; Returns: number }
      calc_lead_time_from_events: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_days: number
          median_days: number
          sample_size: number
        }[]
      }
      calc_time_in_stage: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_days: number
          median_days: number
          p90_days: number
          sample_size: number
          stage: string
        }[]
      }
      can_access_budget: {
        Args: { _budget_id: string; _user_id: string }
        Returns: boolean
      }
      check_and_create_alerts: { Args: never; Returns: number }
      cleanup_old_snapshots: { Args: never; Returns: number }
      compare_snapshots: {
        Args: { p_date_a: string; p_date_b: string }
        Returns: Json
      }
      default_win_probability: { Args: { _stage: string }; Returns: number }
      derive_pipeline_stage: {
        Args: { _internal_status: string }
        Returns: string
      }
      get_dashboard_summary: { Args: never; Returns: Json }
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
      list_failed_lead_sources: {
        Args: { p_limit?: number }
        Returns: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          budget_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          client_id: string | null
          created_at: string
          external_id: string | null
          form_id: string | null
          form_name: string | null
          id: string
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          raw_payload: Json
          received_at: string
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lead_sources"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      resolve_lead_owner: {
        Args: {
          p_campaign_id?: string
          p_campaign_name?: string
          p_city?: string
          p_form_id?: string
          p_source: string
        }
        Returns: string
      }
      run_reengagement_sweep: {
        Args: never
        Returns: {
          moved_count: number
          sample: Json
        }[]
      }
      set_primary_supplier_price: {
        Args: { p_catalog_item_id: string; p_price_id: string }
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
