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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_clients: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          institution_id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revocation_reason: string | null
          revoked_at: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["api_client_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revocation_reason?: string | null
          revoked_at?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_client_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_reference: string | null
          actor_type: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          request_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_reference?: string | null
          actor_type: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_reference?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      credential_events: {
        Row: {
          actor_reference: string | null
          actor_type: string
          api_client_id: string | null
          created_at: string
          credential_id: string
          event_data: Json
          event_type: Database["public"]["Enums"]["credential_event_type"]
          id: string
          new_status: Database["public"]["Enums"]["credential_status"] | null
          previous_status:
            | Database["public"]["Enums"]["credential_status"]
            | null
          reason: string | null
        }
        Insert: {
          actor_reference?: string | null
          actor_type: string
          api_client_id?: string | null
          created_at?: string
          credential_id: string
          event_data?: Json
          event_type: Database["public"]["Enums"]["credential_event_type"]
          id?: string
          new_status?: Database["public"]["Enums"]["credential_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["credential_status"]
            | null
          reason?: string | null
        }
        Update: {
          actor_reference?: string | null
          actor_type?: string
          api_client_id?: string | null
          created_at?: string
          credential_id?: string
          event_data?: Json
          event_type?: Database["public"]["Enums"]["credential_event_type"]
          id?: string
          new_status?: Database["public"]["Enums"]["credential_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["credential_status"]
            | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_events_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_events_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_import_batches: {
        Row: {
          api_client_id: string | null
          completed_at: string | null
          created_at: string
          error_summary: Json
          external_batch_id: string | null
          failure_count: number
          id: string
          institution_id: string
          metadata: Json
          started_at: string | null
          status: Database["public"]["Enums"]["import_batch_status"]
          success_count: number
          total_records: number
          updated_at: string
        }
        Insert: {
          api_client_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_summary?: Json
          external_batch_id?: string | null
          failure_count?: number
          id?: string
          institution_id: string
          metadata?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          success_count?: number
          total_records?: number
          updated_at?: string
        }
        Update: {
          api_client_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_summary?: Json
          external_batch_id?: string | null
          failure_count?: number
          id?: string
          institution_id?: string
          metadata?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          success_count?: number
          total_records?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_import_batches_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_import_batches_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Relationships: []
      }
      credentials: {
        Row: {
          created_at: string
          credential_number: string | null
          credential_type_id: string
          description: string | null
          document_hash_sha256: string | null
          external_reference: string | null
          id: string
          import_batch_id: string | null
          institution_id: string
          issued_at: string
          metadata: Json
          person_id: string
          program_id: string | null
          registered_at_raes: string
          registered_by_api_client_id: string | null
          registered_by_reference: string | null
          revocation_reason: string | null
          revoked_at: string | null
          source_type: Database["public"]["Enums"]["credential_source_type"]
          status: Database["public"]["Enums"]["credential_status"]
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          credential_number?: string | null
          credential_type_id: string
          description?: string | null
          document_hash_sha256?: string | null
          external_reference?: string | null
          id?: string
          import_batch_id?: string | null
          institution_id: string
          issued_at: string
          metadata?: Json
          person_id: string
          program_id?: string | null
          registered_at_raes?: string
          registered_by_api_client_id?: string | null
          registered_by_reference?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          source_type?: Database["public"]["Enums"]["credential_source_type"]
          status?: Database["public"]["Enums"]["credential_status"]
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          credential_number?: string | null
          credential_type_id?: string
          description?: string | null
          document_hash_sha256?: string | null
          external_reference?: string | null
          id?: string
          import_batch_id?: string | null
          institution_id?: string
          issued_at?: string
          metadata?: Json
          person_id?: string
          program_id?: string | null
          registered_at_raes?: string
          registered_by_api_client_id?: string | null
          registered_by_reference?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          source_type?: Database["public"]["Enums"]["credential_source_type"]
          status?: Database["public"]["Enums"]["credential_status"]
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_credential_type_id_fkey"
            columns: ["credential_type_id"]
            isOneToOne: false
            referencedRelation: "credential_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "credential_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_registered_by_api_client_id_fkey"
            columns: ["registered_by_api_client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          name: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          name: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          name?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          institution_type: string | null
          metadata: Json
          name: string
          nit: string
          official_code: string | null
          official_code_type: string | null
          status: Database["public"]["Enums"]["institution_status"]
          updated_at: string
          verification_digit: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          institution_type?: string | null
          metadata?: Json
          name: string
          nit: string
          official_code?: string | null
          official_code_type?: string | null
          status?: Database["public"]["Enums"]["institution_status"]
          updated_at?: string
          verification_digit?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          institution_type?: string | null
          metadata?: Json
          name?: string
          nit?: string
          official_code?: string | null
          official_code_type?: string | null
          status?: Database["public"]["Enums"]["institution_status"]
          updated_at?: string
          verification_digit?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      persons: {
        Row: {
          birth_date: string | null
          created_at: string
          document_number: string
          document_type: string
          first_names: string
          id: string
          last_names: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          document_number: string
          document_type: string
          first_names: string
          id?: string
          last_names: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          document_number?: string
          document_type?: string
          first_names?: string
          id?: string
          last_names?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_document_type_fk"
            columns: ["document_type"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["code"]
          },
        ]
      }
      programs: {
        Row: {
          academic_level: string | null
          code: string | null
          created_at: string
          id: string
          institution_id: string
          metadata: Json
          name: string
          snies_code: string | null
          status: Database["public"]["Enums"]["program_status"]
          updated_at: string
        }
        Insert: {
          academic_level?: string | null
          code?: string | null
          created_at?: string
          id?: string
          institution_id: string
          metadata?: Json
          name: string
          snies_code?: string | null
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
        }
        Update: {
          academic_level?: string | null
          code?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          metadata?: Json
          name?: string
          snies_code?: string | null
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_credential: {
        Args: {
          p_credential_number?: string
          p_credential_type_id: string
          p_description?: string
          p_document_hash_sha256?: string
          p_external_reference?: string
          p_institution_id: string
          p_issued_at: string
          p_metadata?: Json
          p_person_id: string
          p_program_id?: string
          p_registered_by_api_client_id?: string
          p_registered_by_reference?: string
          p_source_type?: Database["public"]["Enums"]["credential_source_type"]
          p_title: string
          p_valid_from?: string
          p_valid_until?: string
        }
        Returns: {
          created_at: string
          credential_number: string | null
          credential_type_id: string
          description: string | null
          document_hash_sha256: string | null
          external_reference: string | null
          id: string
          import_batch_id: string | null
          institution_id: string
          issued_at: string
          metadata: Json
          person_id: string
          program_id: string | null
          registered_at_raes: string
          registered_by_api_client_id: string | null
          registered_by_reference: string | null
          revocation_reason: string | null
          revoked_at: string | null
          source_type: Database["public"]["Enums"]["credential_source_type"]
          status: Database["public"]["Enums"]["credential_status"]
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credentials"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_credential: {
        Args: {
          p_actor_reference?: string
          p_actor_type: string
          p_api_client_id?: string
          p_credential_id: string
          p_reason: string
        }
        Returns: {
          created_at: string
          credential_number: string | null
          credential_type_id: string
          description: string | null
          document_hash_sha256: string | null
          external_reference: string | null
          id: string
          import_batch_id: string | null
          institution_id: string
          issued_at: string
          metadata: Json
          person_id: string
          program_id: string | null
          registered_at_raes: string
          registered_by_api_client_id: string | null
          registered_by_reference: string | null
          revocation_reason: string | null
          revoked_at: string | null
          source_type: Database["public"]["Enums"]["credential_source_type"]
          status: Database["public"]["Enums"]["credential_status"]
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credentials"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_credential: {
        Args: {
          p_actor_reference?: string
          p_actor_type: string
          p_api_client_id?: string
          p_credential_id: string
          p_reason: string
        }
        Returns: {
          created_at: string
          credential_number: string | null
          credential_type_id: string
          description: string | null
          document_hash_sha256: string | null
          external_reference: string | null
          id: string
          import_batch_id: string | null
          institution_id: string
          issued_at: string
          metadata: Json
          person_id: string
          program_id: string | null
          registered_at_raes: string
          registered_by_api_client_id: string | null
          registered_by_reference: string | null
          revocation_reason: string | null
          revoked_at: string | null
          source_type: Database["public"]["Enums"]["credential_source_type"]
          status: Database["public"]["Enums"]["credential_status"]
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credentials"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      api_client_status: "ACTIVE" | "SUSPENDED" | "REVOKED"
      catalog_status: "ACTIVE" | "INACTIVE"
      credential_event_type:
        | "CREATED"
        | "UPDATED"
        | "REVOKED"
        | "VOIDED"
        | "SYNCED"
      credential_source_type:
        | "INSTITUTION_API"
        | "ADMIN"
        | "MIGRATION"
        | "SYSTEM"
      credential_status: "ACTIVE" | "REVOKED" | "VOIDED"
      import_batch_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "PARTIAL"
        | "FAILED"
      institution_status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
      program_status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
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
  public: {
    Enums: {
      api_client_status: ["ACTIVE", "SUSPENDED", "REVOKED"],
      catalog_status: ["ACTIVE", "INACTIVE"],
      credential_event_type: [
        "CREATED",
        "UPDATED",
        "REVOKED",
        "VOIDED",
        "SYNCED",
      ],
      credential_source_type: [
        "INSTITUTION_API",
        "ADMIN",
        "MIGRATION",
        "SYSTEM",
      ],
      credential_status: ["ACTIVE", "REVOKED", "VOIDED"],
      import_batch_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "PARTIAL",
        "FAILED",
      ],
      institution_status: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      program_status: ["ACTIVE", "INACTIVE", "SUSPENDED"],
    },
  },
} as const
