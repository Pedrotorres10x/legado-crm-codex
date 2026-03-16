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
      ai_interactions: {
        Row: {
          agent_id: string | null
          created_at: string
          duration_ms: number | null
          feedback: string | null
          function_name: string
          id: string
          input_summary: string | null
          kb_ids_used: string[] | null
          memory_ids_used: string[] | null
          output_summary: string | null
          prompt_version_id: string | null
          quality_score: number | null
          tokens_used: number | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          feedback?: string | null
          function_name: string
          id?: string
          input_summary?: string | null
          kb_ids_used?: string[] | null
          memory_ids_used?: string[] | null
          output_summary?: string | null
          prompt_version_id?: string | null
          quality_score?: number | null
          tokens_used?: number | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          feedback?: string | null
          function_name?: string
          id?: string
          input_summary?: string | null
          kb_ids_used?: string[] | null
          memory_ids_used?: string[] | null
          output_summary?: string | null
          prompt_version_id?: string | null
          quality_score?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_base: {
        Row: {
          applies_to: string[] | null
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          priority: number
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          applies_to?: string[] | null
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          applies_to?: string[] | null
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          category: string
          content: string
          context_key: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          relevance_score: number
          source_function: string | null
          source_interaction_id: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          category: string
          content: string
          context_key: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          relevance_score?: number
          source_function?: string | null
          source_interaction_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          content?: string
          context_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          relevance_score?: number
          source_function?: string | null
          source_interaction_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      ai_prompt_versions: {
        Row: {
          avg_quality_score: number | null
          change_reason: string | null
          created_at: string
          created_by: string | null
          function_name: string
          id: string
          interactions_count: number
          is_active: boolean
          performance_notes: string | null
          system_prompt: string
          version: number
        }
        Insert: {
          avg_quality_score?: number | null
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          function_name: string
          id?: string
          interactions_count?: number
          is_active?: boolean
          performance_notes?: string | null
          system_prompt: string
          version?: number
        }
        Update: {
          avg_quality_score?: number | null
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          function_name?: string
          id?: string
          interactions_count?: number
          is_active?: boolean
          performance_notes?: string | null
          system_prompt?: string
          version?: number
        }
        Relationships: []
      }
      analytics_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          type: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          type: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          type?: string
          value?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          emailed: boolean
          id: string
          title: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          emailed?: boolean
          id?: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          emailed?: boolean
          id?: string
          title?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          record_snapshot: Json | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          record_snapshot?: Json | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          record_snapshot?: Json | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      change_requests: {
        Row: {
          created_at: string
          current_value: string | null
          description: string
          entity_id: string
          entity_label: string | null
          entity_type: string
          field_name: string | null
          id: string
          new_value: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          resolver_note: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_value?: string | null
          description: string
          entity_id: string
          entity_label?: string | null
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_value?: string | null
          description?: string
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: string
        }
        Relationships: []
      }
      chat_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_direct: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_direct?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_direct?: boolean
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agency_commission: number
          agency_commission_pct: number
          agent_base_amount: number
          agent_base_pct: number
          agent_id: string
          agent_total: number
          buying_agent_id: string | null
          buying_amount: number
          buying_field_agent_id: string | null
          buying_field_amount: number
          buying_origin_agent_id: string | null
          buying_origin_amount: number
          buying_pct: number
          created_at: string
          field_pct: number
          horus_bonus: boolean
          horus_bonus_amount: number
          horus_bonus_pct: number
          id: string
          listing_agent_id: string | null
          listing_amount: number
          listing_field_agent_id: string | null
          listing_field_amount: number
          listing_origin_agent_id: string | null
          listing_origin_amount: number
          listing_pct: number
          notes: string | null
          origin_pct: number
          property_id: string | null
          sale_price: number
          status: string
          updated_at: string
        }
        Insert: {
          agency_commission?: number
          agency_commission_pct?: number
          agent_base_amount?: number
          agent_base_pct?: number
          agent_id: string
          agent_total?: number
          buying_agent_id?: string | null
          buying_amount?: number
          buying_field_agent_id?: string | null
          buying_field_amount?: number
          buying_origin_agent_id?: string | null
          buying_origin_amount?: number
          buying_pct?: number
          created_at?: string
          field_pct?: number
          horus_bonus?: boolean
          horus_bonus_amount?: number
          horus_bonus_pct?: number
          id?: string
          listing_agent_id?: string | null
          listing_amount?: number
          listing_field_agent_id?: string | null
          listing_field_amount?: number
          listing_origin_agent_id?: string | null
          listing_origin_amount?: number
          listing_pct?: number
          notes?: string | null
          origin_pct?: number
          property_id?: string | null
          sale_price: number
          status?: string
          updated_at?: string
        }
        Update: {
          agency_commission?: number
          agency_commission_pct?: number
          agent_base_amount?: number
          agent_base_pct?: number
          agent_id?: string
          agent_total?: number
          buying_agent_id?: string | null
          buying_amount?: number
          buying_field_agent_id?: string | null
          buying_field_amount?: number
          buying_origin_agent_id?: string | null
          buying_origin_amount?: number
          buying_pct?: number
          created_at?: string
          field_pct?: number
          horus_bonus?: boolean
          horus_bonus_amount?: number
          horus_bonus_pct?: number
          id?: string
          listing_agent_id?: string | null
          listing_amount?: number
          listing_field_agent_id?: string | null
          listing_field_amount?: number
          listing_origin_agent_id?: string | null
          listing_origin_amount?: number
          listing_pct?: number
          notes?: string | null
          origin_pct?: number
          property_id?: string | null
          sale_price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          agent_id: string | null
          body_preview: string | null
          channel: string
          contact_id: string
          created_at: string
          demand_id: string | null
          direction: string
          error_message: string | null
          html_preview: string | null
          id: string
          metadata: Json | null
          property_id: string | null
          provider_msg_id: string | null
          source: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          body_preview?: string | null
          channel: string
          contact_id: string
          created_at?: string
          demand_id?: string | null
          direction?: string
          error_message?: string | null
          html_preview?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          provider_msg_id?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          body_preview?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          demand_id?: string | null
          direction?: string
          error_message?: string | null
          html_preview?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          provider_msg_id?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_invoices: {
        Row: {
          agent_id: string | null
          amount: number
          commission_id: string | null
          concept: string
          contact_id: string
          created_at: string
          faktura_url: string | null
          id: string
          invoice_number: string | null
          property_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          amount?: number
          commission_id?: string | null
          concept?: string
          contact_id: string
          created_at?: string
          faktura_url?: string | null
          id?: string
          invoice_number?: string | null
          property_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          commission_id?: string | null
          concept?: string
          contact_id?: string
          created_at?: string
          faktura_url?: string | null
          id?: string
          invoice_number?: string | null
          property_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_invoices_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          agent_id: string | null
          birth_date: string | null
          city: string | null
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          email: string | null
          full_name: string
          gdpr_consent: boolean
          gdpr_consent_at: string | null
          gdpr_consent_ip: string | null
          gdpr_legal_basis: string
          id: string
          id_number: string | null
          listing_price: number | null
          nationality: string | null
          needs_mortgage: boolean
          notes: string | null
          opt_out: boolean
          phone: string | null
          phone2: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          purchase_date: string | null
          sale_date: string | null
          source_ref: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["contact_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          birth_date?: string | null
          city?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          email?: string | null
          full_name: string
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          gdpr_consent_ip?: string | null
          gdpr_legal_basis?: string
          id?: string
          id_number?: string | null
          listing_price?: number | null
          nationality?: string | null
          needs_mortgage?: boolean
          notes?: string | null
          opt_out?: boolean
          phone?: string | null
          phone2?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          purchase_date?: string | null
          sale_date?: string | null
          source_ref?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          birth_date?: string | null
          city?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          gdpr_consent_ip?: string | null
          gdpr_legal_basis?: string
          id?: string
          id_number?: string | null
          listing_price?: number | null
          nationality?: string | null
          needs_mortgage?: boolean
          notes?: string | null
          opt_out?: boolean
          phone?: string | null
          phone2?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          purchase_date?: string | null
          sale_date?: string | null
          source_ref?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_signers: {
        Row: {
          contact_id: string | null
          contract_id: string
          created_at: string
          document_hash: string | null
          id: string
          otp_attempts: number
          otp_code: string | null
          otp_expires_at: string | null
          otp_verified: boolean
          signature_hash: string | null
          signature_status: string
          signature_token: string
          signature_url: string | null
          signed_at: string | null
          signer_email: string | null
          signer_id_number: string | null
          signer_ip: string | null
          signer_label: string
          signer_name: string | null
          signer_user_agent: string | null
        }
        Insert: {
          contact_id?: string | null
          contract_id: string
          created_at?: string
          document_hash?: string | null
          id?: string
          otp_attempts?: number
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified?: boolean
          signature_hash?: string | null
          signature_status?: string
          signature_token?: string
          signature_url?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_id_number?: string | null
          signer_ip?: string | null
          signer_label?: string
          signer_name?: string | null
          signer_user_agent?: string | null
        }
        Update: {
          contact_id?: string | null
          contract_id?: string
          created_at?: string
          document_hash?: string | null
          id?: string
          otp_attempts?: number
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified?: boolean
          signature_hash?: string | null
          signature_status?: string
          signature_token?: string
          signature_url?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_id_number?: string | null
          signer_ip?: string | null
          signer_label?: string
          signer_name?: string | null
          signer_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "generated_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          agent_id: string | null
          category: string
          content: string
          created_at: string
          id: string
          name: string
          placeholders: string[] | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          name: string
          placeholders?: string[] | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          name?: string
          placeholders?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      document_contacts: {
        Row: {
          contact_id: string
          created_at: string
          document_id: string
          link_role: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          document_id: string
          link_role?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          document_id?: string
          link_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_contacts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_properties: {
        Row: {
          created_at: string
          document_id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          property_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_properties_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket_id: string
          contract_id: string | null
          created_at: string
          document_kind: string
          expires_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          source_context: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket_id: string
          contract_id?: string | null
          created_at?: string
          document_kind?: string
          expires_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          source_context?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket_id?: string
          contract_id?: string | null
          created_at?: string
          document_kind?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          source_context?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "generated_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          auto_match: boolean
          cities: string[] | null
          contact_id: string
          created_at: string
          features: string[] | null
          financing_type: string | null
          floor_preference: string | null
          id: string
          is_active: boolean | null
          max_mortgage_payment: number | null
          max_price: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_price: number | null
          min_surface: number | null
          notes: string | null
          operation: Database["public"]["Enums"]["operation_type"] | null
          preferred_orientation: string[] | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          property_types: string[] | null
          updated_at: string
          urgency_months: number | null
          zones: string[] | null
        }
        Insert: {
          auto_match?: boolean
          cities?: string[] | null
          contact_id: string
          created_at?: string
          features?: string[] | null
          financing_type?: string | null
          floor_preference?: string | null
          id?: string
          is_active?: boolean | null
          max_mortgage_payment?: number | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          min_surface?: number | null
          notes?: string | null
          operation?: Database["public"]["Enums"]["operation_type"] | null
          preferred_orientation?: string[] | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          property_types?: string[] | null
          updated_at?: string
          urgency_months?: number | null
          zones?: string[] | null
        }
        Update: {
          auto_match?: boolean
          cities?: string[] | null
          contact_id?: string
          created_at?: string
          features?: string[] | null
          financing_type?: string | null
          floor_preference?: string | null
          id?: string
          is_active?: boolean | null
          max_mortgage_payment?: number | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          min_surface?: number | null
          notes?: string | null
          operation?: Database["public"]["Enums"]["operation_type"] | null
          preferred_orientation?: string[] | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          property_types?: string[] | null
          updated_at?: string
          urgency_months?: number | null
          zones?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "demands_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event: string
          http_status: number | null
          id: string
          payload: Json | null
          response_body: string | null
          status: string
          target: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          response_body?: string | null
          status?: string
          target: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          response_body?: string | null
          status?: string
          target?: string
        }
        Relationships: []
      }
      featured_cache: {
        Row: {
          ai_analysis: string | null
          created_at: string
          id: string
          image_score: number
          property_data: Json
          property_id: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          id?: string
          image_score?: number
          property_data?: Json
          property_id: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          id?: string
          image_score?: number
          property_data?: Json
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_cache_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_contracts: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          content: string
          content_hash: string | null
          created_at: string
          document_hash: string | null
          id: string
          property_id: string | null
          signature_status: string
          signature_token: string | null
          signature_url: string | null
          signed_at: string | null
          signer_id_number: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          template_id: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          content: string
          content_hash?: string | null
          created_at?: string
          document_hash?: string | null
          id?: string
          property_id?: string | null
          signature_status?: string
          signature_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_id_number?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          template_id: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string
          document_hash?: string | null
          id?: string
          property_id?: string | null
          signature_status?: string
          signature_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_id_number?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      idealista_contact_mappings: {
        Row: {
          created_at: string
          id: string
          idealista_contact_id: number
          idealista_contact_name: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idealista_contact_id: number
          idealista_contact_name?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idealista_contact_id?: number
          idealista_contact_name?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idealista_contact_mappings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      idealista_mappings: {
        Row: {
          created_at: string
          id: string
          idealista_ad_id: string | null
          idealista_customer_id: string | null
          idealista_property_code: string | null
          idealista_response: Json | null
          image_checksums: Json | null
          last_error: string | null
          last_synced_at: string | null
          property_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idealista_ad_id?: string | null
          idealista_customer_id?: string | null
          idealista_property_code?: string | null
          idealista_response?: Json | null
          image_checksums?: Json | null
          last_error?: string | null
          last_synced_at?: string | null
          property_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idealista_ad_id?: string | null
          idealista_customer_id?: string | null
          idealista_property_code?: string | null
          idealista_response?: Json | null
          image_checksums?: Json | null
          last_error?: string | null
          last_synced_at?: string | null
          property_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idealista_mappings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          ai_summary: string | null
          agent_id: string | null
          call_duration_seconds: number | null
          call_sid: string | null
          call_status: string | null
          contact_id: string
          created_at: string
          description: string | null
          follow_up_task_id: string | null
          id: string
          interaction_date: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          property_id: string | null
          recording_url: string | null
          subject: string | null
          transcript: string | null
          transcript_status: string | null
        }
        Insert: {
          ai_summary?: string | null
          agent_id?: string | null
          call_duration_seconds?: number | null
          call_sid?: string | null
          call_status?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          follow_up_task_id?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          property_id?: string | null
          recording_url?: string | null
          subject?: string | null
          transcript?: string | null
          transcript_status?: string | null
        }
        Update: {
          ai_summary?: string | null
          agent_id?: string | null
          call_duration_seconds?: number | null
          call_sid?: string | null
          call_status?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          follow_up_task_id?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          property_id?: string | null
          recording_url?: string | null
          subject?: string | null
          transcript?: string | null
          transcript_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_comments: {
        Row: {
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      linkinbio_events: {
        Row: {
          agent_id: string | null
          agent_slug: string
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          event_type: string
          id: string
          link_id: string | null
          link_url: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_slug: string
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          link_id?: string | null
          link_url?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_slug?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          link_id?: string | null
          link_url?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      match_emails: {
        Row: {
          agent_id: string | null
          contact_id: string
          demand_id: string
          email_to: string
          error_message: string | null
          id: string
          match_id: string | null
          property_id: string
          sent_at: string
          status: string
          subject: string
        }
        Insert: {
          agent_id?: string | null
          contact_id: string
          demand_id: string
          email_to: string
          error_message?: string | null
          id?: string
          match_id?: string | null
          property_id: string
          sent_at?: string
          status?: string
          subject: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: string
          demand_id?: string
          email_to?: string
          error_message?: string | null
          id?: string
          match_id?: string | null
          property_id?: string
          sent_at?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_emails_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_emails_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_emails_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sender_logs: {
        Row: {
          contacts_processed: number
          contacts_skipped: number
          demands_total: number
          duration_ms: number | null
          emails_failed: number
          emails_sent: number
          errors: string[] | null
          id: string
          matches_created: number
          matches_skipped_already_sent: number
          run_at: string
          whatsapp_failed: number
          whatsapp_sent: number
        }
        Insert: {
          contacts_processed?: number
          contacts_skipped?: number
          demands_total?: number
          duration_ms?: number | null
          emails_failed?: number
          emails_sent?: number
          errors?: string[] | null
          id?: string
          matches_created?: number
          matches_skipped_already_sent?: number
          run_at?: string
          whatsapp_failed?: number
          whatsapp_sent?: number
        }
        Update: {
          contacts_processed?: number
          contacts_skipped?: number
          demands_total?: number
          duration_ms?: number | null
          emails_failed?: number
          emails_sent?: number
          errors?: string[] | null
          id?: string
          matches_created?: number
          matches_skipped_already_sent?: number
          run_at?: string
          whatsapp_failed?: number
          whatsapp_sent?: number
        }
        Relationships: []
      }
      matches: {
        Row: {
          agent_id: string | null
          compatibility: number | null
          created_at: string
          demand_id: string
          id: string
          notes: string | null
          property_id: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          compatibility?: number | null
          created_at?: string
          demand_id: string
          id?: string
          notes?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          compatibility?: number | null
          created_at?: string
          demand_id?: string
          id?: string
          notes?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      media_access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_access_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_incoming: {
        Row: {
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string
          description: string | null
          energy_certificate: string | null
          features: string[] | null
          id: string
          images: string[] | null
          imported_property_id: string | null
          latitude: number | null
          longitude: number | null
          mls_agency_name: string | null
          mls_property_id: string
          operation_type: string | null
          price: number | null
          property_type: string | null
          raw_data: Json | null
          reference_code: string | null
          reviewed_by: string | null
          status: string
          surface_area: number | null
          title: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          energy_certificate?: string | null
          features?: string[] | null
          id?: string
          images?: string[] | null
          imported_property_id?: string | null
          latitude?: number | null
          longitude?: number | null
          mls_agency_name?: string | null
          mls_property_id: string
          operation_type?: string | null
          price?: number | null
          property_type?: string | null
          raw_data?: Json | null
          reference_code?: string | null
          reviewed_by?: string | null
          status?: string
          surface_area?: number | null
          title: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          energy_certificate?: string | null
          features?: string[] | null
          id?: string
          images?: string[] | null
          imported_property_id?: string | null
          latitude?: number | null
          longitude?: number | null
          mls_agency_name?: string | null
          mls_property_id?: string
          operation_type?: string | null
          price?: number | null
          property_type?: string | null
          raw_data?: Json | null
          reference_code?: string | null
          reviewed_by?: string | null
          status?: string
          surface_area?: number | null
          title?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_incoming_imported_property_id_fkey"
            columns: ["imported_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          is_read: boolean
          title: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          is_read?: boolean
          title: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          is_read?: boolean
          title?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          agent_id: string | null
          amount: number
          conditions: string | null
          contact_id: string
          counter_amount: number | null
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          offer_type: string
          property_id: string
          response_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          conditions?: string | null
          contact_id: string
          counter_amount?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          offer_type?: string
          property_id: string
          response_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          conditions?: string | null
          contact_id?: string
          counter_amount?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          offer_type?: string
          property_id?: string
          response_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_reengagement: {
        Row: {
          channel: string
          contact_id: string
          id: string
          message_preview: string | null
          message_type: string
          sent_at: string
          year: number
        }
        Insert: {
          channel?: string
          contact_id: string
          id?: string
          message_preview?: string | null
          message_type: string
          sent_at?: string
          year: number
        }
        Update: {
          channel?: string
          contact_id?: string
          id?: string
          message_preview?: string | null
          message_type?: string
          sent_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_reengagement_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feed_properties: {
        Row: {
          first_sent_at: string
          id: string
          last_sent_at: string
          portal_feed_id: string
          property_id: string
          removed_at: string | null
        }
        Insert: {
          first_sent_at?: string
          id?: string
          last_sent_at?: string
          portal_feed_id: string
          property_id: string
          removed_at?: string | null
        }
        Update: {
          first_sent_at?: string
          id?: string
          last_sent_at?: string
          portal_feed_id?: string
          property_id?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_feed_properties_portal_feed_id_fkey"
            columns: ["portal_feed_id"]
            isOneToOne: false
            referencedRelation: "portal_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_feed_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feeds: {
        Row: {
          api_credentials: Json | null
          created_at: string
          display_name: string
          feed_token: string
          filters: Json | null
          format: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
          notes: string | null
          portal_name: string
          properties_count: number
          updated_at: string
        }
        Insert: {
          api_credentials?: Json | null
          created_at?: string
          display_name: string
          feed_token?: string
          filters?: Json | null
          format?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          notes?: string | null
          portal_name: string
          properties_count?: number
          updated_at?: string
        }
        Update: {
          api_credentials?: Json | null
          created_at?: string
          display_name?: string
          feed_token?: string
          filters?: Json | null
          format?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          notes?: string | null
          portal_name?: string
          properties_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      portal_leads: {
        Row: {
          contact_id: string | null
          created_at: string
          extracted_data: Json | null
          id: string
          portal_name: string
          property_id: string | null
          raw_email_from: string | null
          raw_email_subject: string | null
          status: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          extracted_data?: Json | null
          id?: string
          portal_name: string
          property_id?: string | null
          raw_email_from?: string | null
          raw_email_subject?: string | null
          status?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          extracted_data?: Json | null
          id?: string
          portal_name?: string
          property_id?: string | null
          raw_email_from?: string | null
          raw_email_subject?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_property_exclusions: {
        Row: {
          created_at: string
          excluded_by: string | null
          id: string
          portal_feed_id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          portal_feed_id: string
          property_id: string
        }
        Update: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          portal_feed_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_property_exclusions_portal_feed_id_fkey"
            columns: ["portal_feed_id"]
            isOneToOne: false
            referencedRelation: "portal_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_property_exclusions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_owner_price: number | null
          new_price: number | null
          old_owner_price: number | null
          old_price: number | null
          property_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_owner_price?: number | null
          new_price?: number | null
          old_owner_price?: number | null
          old_price?: number | null
          property_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_owner_price?: number | null
          new_price?: number | null
          old_owner_price?: number | null
          old_price?: number | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          fcm_token: string | null
          full_name: string
          gcal_embed_url: string | null
          id: string
          id_number: string | null
          instagram_url: string | null
          linkedin_url: string | null
          phone: string | null
          public_slug: string | null
          twilio_caller_id: string | null
          twilio_caller_id_verified: boolean
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          fcm_token?: string | null
          full_name?: string
          gcal_embed_url?: string | null
          id?: string
          id_number?: string | null
          instagram_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          public_slug?: string | null
          twilio_caller_id?: string | null
          twilio_caller_id_verified?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          fcm_token?: string | null
          full_name?: string
          gcal_embed_url?: string | null
          id?: string
          id_number?: string | null
          instagram_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          public_slug?: string | null
          twilio_caller_id?: string | null
          twilio_caller_id_verified?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          agent_id: string | null
          arras_amount: number | null
          arras_buyer_id: string | null
          arras_date: string | null
          arras_status: string
          auto_match: boolean
          bathrooms: number | null
          bedrooms: number | null
          built_area: number | null
          city: string | null
          closing_notes: string | null
          commission: number | null
          country: string
          created_at: string
          crm_reference: string | null
          deed_date: string | null
          deed_notary: string | null
          description: string | null
          door: string | null
          energy_cert: string | null
          energy_consumption_value: number | null
          energy_emissions_value: number | null
          features: string[] | null
          floor: string | null
          floor_number: string | null
          floor_plans: string[] | null
          has_elevator: boolean | null
          has_garage: boolean | null
          has_garden: boolean | null
          has_pool: boolean | null
          has_terrace: boolean | null
          id: string
          image_order: Json | null
          images: string[] | null
          is_featured: boolean
          is_international: boolean
          key_location: string | null
          legal_risk_docs_count: number
          legal_risk_level: string | null
          legal_risk_summary: string | null
          legal_risk_updated_at: string | null
          latitude: number | null
          longitude: number | null
          mandate_end: string | null
          mandate_notes: string | null
          mandate_start: string | null
          mandate_type: string | null
          operation: Database["public"]["Enums"]["operation_type"]
          owner_id: string | null
          owner_price: number | null
          portal_token: string | null
          price: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          province: string | null
          reference: string | null
          reservation_amount: number | null
          reservation_date: string | null
          search_vector: unknown
          secondary_property_type: string | null
          send_to_idealista: boolean
          source: string | null
          source_url: string | null
          staircase: string | null
          status: Database["public"]["Enums"]["property_status"]
          surface_area: number | null
          tags: string[] | null
          title: string
          updated_at: string
          videos: string[] | null
          virtual_tour_url: string | null
          xml_id: string | null
          year_built: number | null
          zip_code: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          arras_amount?: number | null
          arras_buyer_id?: string | null
          arras_date?: string | null
          arras_status?: string
          auto_match?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          closing_notes?: string | null
          commission?: number | null
          country?: string
          created_at?: string
          crm_reference?: string | null
          deed_date?: string | null
          deed_notary?: string | null
          description?: string | null
          door?: string | null
          energy_cert?: string | null
          energy_consumption_value?: number | null
          energy_emissions_value?: number | null
          features?: string[] | null
          floor?: string | null
          floor_number?: string | null
          floor_plans?: string[] | null
          has_elevator?: boolean | null
          has_garage?: boolean | null
          has_garden?: boolean | null
          has_pool?: boolean | null
          has_terrace?: boolean | null
          id?: string
          image_order?: Json | null
          images?: string[] | null
          is_featured?: boolean
          is_international?: boolean
          key_location?: string | null
          legal_risk_docs_count?: number
          legal_risk_level?: string | null
          legal_risk_summary?: string | null
          legal_risk_updated_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mandate_end?: string | null
          mandate_notes?: string | null
          mandate_start?: string | null
          mandate_type?: string | null
          operation?: Database["public"]["Enums"]["operation_type"]
          owner_id?: string | null
          owner_price?: number | null
          portal_token?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          province?: string | null
          reference?: string | null
          reservation_amount?: number | null
          reservation_date?: string | null
          search_vector?: unknown
          secondary_property_type?: string | null
          send_to_idealista?: boolean
          source?: string | null
          source_url?: string | null
          staircase?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          surface_area?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
          videos?: string[] | null
          virtual_tour_url?: string | null
          xml_id?: string | null
          year_built?: number | null
          zip_code?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          arras_amount?: number | null
          arras_buyer_id?: string | null
          arras_date?: string | null
          arras_status?: string
          auto_match?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          closing_notes?: string | null
          commission?: number | null
          country?: string
          created_at?: string
          crm_reference?: string | null
          deed_date?: string | null
          deed_notary?: string | null
          description?: string | null
          door?: string | null
          energy_cert?: string | null
          energy_consumption_value?: number | null
          energy_emissions_value?: number | null
          features?: string[] | null
          floor?: string | null
          floor_number?: string | null
          floor_plans?: string[] | null
          has_elevator?: boolean | null
          has_garage?: boolean | null
          has_garden?: boolean | null
          has_pool?: boolean | null
          has_terrace?: boolean | null
          id?: string
          image_order?: Json | null
          images?: string[] | null
          is_featured?: boolean
          is_international?: boolean
          key_location?: string | null
          legal_risk_docs_count?: number
          legal_risk_level?: string | null
          legal_risk_summary?: string | null
          legal_risk_updated_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mandate_end?: string | null
          mandate_notes?: string | null
          mandate_start?: string | null
          mandate_type?: string | null
          operation?: Database["public"]["Enums"]["operation_type"]
          owner_id?: string | null
          owner_price?: number | null
          portal_token?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          province?: string | null
          reference?: string | null
          reservation_amount?: number | null
          reservation_date?: string | null
          search_vector?: unknown
          secondary_property_type?: string | null
          send_to_idealista?: boolean
          source?: string | null
          source_url?: string | null
          staircase?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          surface_area?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          videos?: string[] | null
          virtual_tour_url?: string | null
          xml_id?: string | null
          year_built?: number | null
          zip_code?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_arras_buyer_id_fkey"
            columns: ["arras_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_required: boolean
          label: string
          notes: string | null
          property_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          label: string
          notes?: string | null
          property_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          label?: string
          notes?: string | null
          property_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          ownership_pct: number | null
          property_id: string
          role: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          ownership_pct?: number | null
          property_id: string
          role?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          ownership_pct?: number | null
          property_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_sequences: {
        Row: {
          agent_id: string | null
          completed: boolean
          contact_id: string
          created_at: string
          current_step: number
          id: string
          last_step_at: string | null
          metadata: Json | null
          next_step_at: string | null
          paused: boolean
          replied: boolean
          started_at: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          completed?: boolean
          contact_id: string
          created_at?: string
          current_step?: number
          id?: string
          last_step_at?: string | null
          metadata?: Json | null
          next_step_at?: string | null
          paused?: boolean
          replied?: boolean
          started_at?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          completed?: boolean
          contact_id?: string
          created_at?: string
          current_step?: number
          id?: string
          last_step_at?: string | null
          metadata?: Json | null
          next_step_at?: string | null
          paused?: boolean
          replied?: boolean
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_sequences_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_config: {
        Row: {
          base_url: string
          config: Json
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          last_heartbeat: string | null
          satellite_key: string
          updated_at: string
        }
        Insert: {
          base_url?: string
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          last_heartbeat?: string | null
          satellite_key: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          last_heartbeat?: string | null
          satellite_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agent_id: string
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          priority: string
          property_id: string | null
          recurrence: string | null
          recurrence_parent_id: string | null
          source: string | null
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          property_id?: string | null
          recurrence?: string | null
          recurrence_parent_id?: string | null
          source?: string | null
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          property_id?: string | null
          recurrence?: string | null
          recurrence_parent_id?: string | null
          source?: string | null
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      visits: {
        Row: {
          agent_id: string | null
          confirmation_ip: string | null
          confirmation_status: string
          confirmation_token: string | null
          confirmation_user_agent: string | null
          confirmed_at: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          property_id: string
          result: string | null
          visit_date: string
        }
        Insert: {
          agent_id?: string | null
          confirmation_ip?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_user_agent?: string | null
          confirmed_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          result?: string | null
          visit_date: string
        }
        Update: {
          agent_id?: string | null
          confirmation_ip?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_user_agent?: string | null
          confirmed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          result?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_daily_counter: {
        Row: {
          count: number
          day: string
        }
        Insert: {
          count?: number
          day?: string
        }
        Update: {
          count?: number
          day?: string
        }
        Relationships: []
      }
      web_pageviews: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: string
          page: string
          referrer: string | null
          session_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          page?: string
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          page?: string
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      xml_feeds: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_count: number
          name: string
          url: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number
          name: string
          url: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number
          name?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_duplicate_contacts: {
        Args: never
        Returns: {
          contact_id_1: string
          contact_id_2: string
          match_field: string
          match_value: string
          name_1: string
          name_2: string
        }[]
      }
      find_property_by_id_suffix: {
        Args: { suffix: string }
        Returns: {
          id: string
        }[]
      }
      generate_property_reference: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      wa_increment_daily: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "agent" | "coordinadora"
      contact_status: "nuevo" | "en_seguimiento" | "activo" | "cerrado"
      contact_type:
        | "propietario"
        | "comprador"
        | "ambos"
        | "prospecto"
        | "colaborador"
        | "comprador_cerrado"
        | "vendedor_cerrado"
        | "contacto"
        | "statefox"
      interaction_type:
        | "llamada"
        | "email"
        | "visita"
        | "whatsapp"
        | "reunion"
        | "nota"
        | "cafe_comida"
      match_status: "pendiente" | "enviado" | "interesado" | "descartado"
      operation_type: "venta" | "alquiler" | "ambas"
      pipeline_stage:
        | "nuevo"
        | "contactado"
        | "en_seguimiento"
        | "cualificado"
        | "visitando"
        | "visita_tasacion"
        | "visita_programada"
        | "mandato_firmado"
        | "mandato"
        | "reunion"
        | "prospecto"
        | "activo"
        | "oferta"
        | "negociacion"
        | "reserva"
        | "escritura"
        | "entregado"
        | "en_venta"
        | "en_cierre"
        | "cerrado"
        | "sin_interes"
        | "clasificado"
        | "inactivo"
      property_status:
        | "disponible"
        | "reservado"
        | "arras"
        | "vendido"
        | "alquilado"
        | "retirado"
        | "no_disponible"
      property_type:
        | "piso"
        | "casa"
        | "chalet"
        | "adosado"
        | "atico"
        | "duplex"
        | "estudio"
        | "local"
        | "oficina"
        | "nave"
        | "terreno"
        | "garaje"
        | "trastero"
        | "otro"
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
      app_role: ["admin", "agent", "coordinadora"],
      contact_status: ["nuevo", "en_seguimiento", "activo", "cerrado"],
      contact_type: [
        "propietario",
        "comprador",
        "ambos",
        "prospecto",
        "colaborador",
        "comprador_cerrado",
        "vendedor_cerrado",
        "contacto",
        "statefox",
      ],
      interaction_type: [
        "llamada",
        "email",
        "visita",
        "whatsapp",
        "reunion",
        "nota",
        "cafe_comida",
      ],
      match_status: ["pendiente", "enviado", "interesado", "descartado"],
      operation_type: ["venta", "alquiler", "ambas"],
      pipeline_stage: [
        "nuevo",
        "contactado",
        "en_seguimiento",
        "cualificado",
        "visitando",
        "visita_tasacion",
        "visita_programada",
        "mandato_firmado",
        "mandato",
        "reunion",
        "prospecto",
        "activo",
        "oferta",
        "negociacion",
        "reserva",
        "escritura",
        "entregado",
        "en_venta",
        "en_cierre",
        "cerrado",
        "sin_interes",
        "clasificado",
        "inactivo",
      ],
      property_status: [
        "disponible",
        "reservado",
        "arras",
        "vendido",
        "alquilado",
        "retirado",
        "no_disponible",
      ],
      property_type: [
        "piso",
        "casa",
        "chalet",
        "adosado",
        "atico",
        "duplex",
        "estudio",
        "local",
        "oficina",
        "nave",
        "terreno",
        "garaje",
        "trastero",
        "otro",
      ],
    },
  },
} as const
