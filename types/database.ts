export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          prompt_code: string
          prompt_text: string
          study_id: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prompt_code: string
          prompt_text: string
          study_id: string
          version: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prompt_code?: string
          prompt_text?: string
          study_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompts_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompts_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "ai_prompts_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "ai_prompts_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          character_count: number | null
          created_at: string
          created_by: string | null
          generated_at: string | null
          generated_text: string
          generation_settings_json: Json
          id: string
          input_description: string | null
          model_name: string
          model_version_or_snapshot: string | null
          notes: string | null
          prompt_text_snapshot: string
          prompt_version_id: string
          provider: string
          run_number: number
          sentence_count: number | null
          study_id: string
          superseded_by: string | null
          video_id: string
          word_count: number | null
        }
        Insert: {
          character_count?: number | null
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          generated_text: string
          generation_settings_json?: Json
          id?: string
          input_description?: string | null
          model_name: string
          model_version_or_snapshot?: string | null
          notes?: string | null
          prompt_text_snapshot: string
          prompt_version_id: string
          provider: string
          run_number: number
          sentence_count?: number | null
          study_id: string
          superseded_by?: string | null
          video_id: string
          word_count?: number | null
        }
        Update: {
          character_count?: number | null
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          generated_text?: string
          generation_settings_json?: Json
          id?: string
          input_description?: string | null
          model_name?: string
          model_version_or_snapshot?: string | null
          notes?: string | null
          prompt_text_snapshot?: string
          prompt_version_id?: string
          provider?: string
          run_number?: number
          sentence_count?: number | null
          study_id?: string
          superseded_by?: string | null
          video_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "ai_runs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "ai_runs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "ai_runs_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "ai_runs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "ai_runs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          admin_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: string
          ip: unknown
          study_id: string | null
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          admin_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          study_id?: string | null
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          admin_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          study_id?: string | null
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "audit_logs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "audit_logs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      claim_codings: {
        Row: {
          action_accuracy: Database["public"]["Enums"]["accuracy_level"] | null
          actor_accuracy: Database["public"]["Enums"]["accuracy_level"] | null
          claim_id: string
          coder_id: string
          created_at: string
          draft_source: string | null
          draft_values: Json | null
          reviewed_at: string | null
          granularity_score: number | null
          id: string
          matched_reference_event_id: string | null
          notes: string | null
          object_accuracy: Database["public"]["Enums"]["accuracy_level"] | null
          support_type: Database["public"]["Enums"]["support_type"]
          temporal_accuracy:
            | Database["public"]["Enums"]["accuracy_level"]
            | null
          updated_at: string
        }
        Insert: {
          action_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          actor_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          claim_id: string
          coder_id: string
          created_at?: string
          draft_source?: string | null
          draft_values?: Json | null
          reviewed_at?: string | null
          granularity_score?: number | null
          id?: string
          matched_reference_event_id?: string | null
          notes?: string | null
          object_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          support_type: Database["public"]["Enums"]["support_type"]
          temporal_accuracy?:
            | Database["public"]["Enums"]["accuracy_level"]
            | null
          updated_at?: string
        }
        Update: {
          action_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          actor_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          claim_id?: string
          coder_id?: string
          created_at?: string
          draft_source?: string | null
          draft_values?: Json | null
          reviewed_at?: string | null
          granularity_score?: number | null
          id?: string
          matched_reference_event_id?: string | null
          notes?: string | null
          object_accuracy?: Database["public"]["Enums"]["accuracy_level"] | null
          support_type?: Database["public"]["Enums"]["support_type"]
          temporal_accuracy?:
            | Database["public"]["Enums"]["accuracy_level"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_codings_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "response_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_codings_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_codings_matched_reference_event_id_fkey"
            columns: ["matched_reference_event_id"]
            isOneToOne: false
            referencedRelation: "reference_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_codings_matched_reference_event_id_fkey"
            columns: ["matched_reference_event_id"]
            isOneToOne: false
            referencedRelation: "v_human_detection_rate"
            referencedColumns: ["reference_event_id"]
          },
        ]
      }
      coding_sessions: {
        Row: {
          coder_id: string
          created_at: string
          draft_generated_at: string | null
          draft_source: string | null
          finalized_at: string | null
          id: string
          notes: string | null
          source_record_id: string
          source_type: Database["public"]["Enums"]["source_type"]
          started_at: string
          status: string
          study_id: string
          updated_at: string
          video_id: string
        }
        Insert: {
          coder_id: string
          created_at?: string
          draft_generated_at?: string | null
          draft_source?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          source_record_id: string
          source_type: Database["public"]["Enums"]["source_type"]
          started_at?: string
          status?: string
          study_id: string
          updated_at?: string
          video_id: string
        }
        Update: {
          coder_id?: string
          created_at?: string
          draft_generated_at?: string | null
          draft_source?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          source_record_id?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          started_at?: string
          status?: string
          study_id?: string
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_sessions_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      observation_events: {
        Row: {
          client_session_id: string | null
          client_timestamp: string | null
          created_at: string
          event_timestamp: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: number
          metadata_json: Json
          observation_id: string
          participant_id: string
          seq: number | null
          video_current_time_ms: number | null
          video_id: string
        }
        Insert: {
          client_session_id?: string | null
          client_timestamp?: string | null
          created_at?: string
          event_timestamp?: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: number
          metadata_json?: Json
          observation_id: string
          participant_id: string
          seq?: number | null
          video_current_time_ms?: number | null
          video_id: string
        }
        Update: {
          client_session_id?: string | null
          client_timestamp?: string | null
          created_at?: string
          event_timestamp?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: number
          metadata_json?: Json
          observation_id?: string
          participant_id?: string
          seq?: number | null
          video_current_time_ms?: number | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observation_events_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "v_observation_metrics"
            referencedColumns: ["observation_id"]
          },
          {
            foreignKeyName: "observation_events_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "v_research_master"
            referencedColumns: ["observation_id"]
          },
          {
            foreignKeyName: "observation_events_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "v_valid_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "observation_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observation_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observation_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          attempt_number: number
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string
          deadline_at: string | null
          device_category: string | null
          draft_revision: number
          draft_saved_at: string | null
          draft_text: string
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number
          page_hidden_seconds: number | null
          participant_id: string
          pause_count: number
          presentation_order: number | null
          replay_count: number
          seek_count: number
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean
          timed_out: boolean
          updated_at: string
          video_id: string
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        Insert: {
          attempt_number?: number
          browser_category?: string | null
          buffering_seconds?: number | null
          character_count?: number | null
          client_info?: Json | null
          created_at?: string
          deadline_at?: string | null
          device_category?: string | null
          draft_revision?: number
          draft_saved_at?: string | null
          draft_text?: string
          effective_elapsed_seconds?: number | null
          first_watch_completed_at?: string | null
          first_watch_seconds?: number | null
          id?: string
          invalidated?: boolean
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          is_practice?: boolean
          observation_text?: string | null
          order_group_id?: string | null
          page_hidden_count?: number
          page_hidden_seconds?: number | null
          participant_id: string
          pause_count?: number
          presentation_order?: number | null
          replay_count?: number
          seek_count?: number
          sentence_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type?:
            | Database["public"]["Enums"]["submission_type"]
            | null
          submitted_at?: string | null
          technical_issue?: boolean
          timed_out?: boolean
          updated_at?: string
          video_id: string
          wall_elapsed_seconds?: number | null
          word_count?: number | null
        }
        Update: {
          attempt_number?: number
          browser_category?: string | null
          buffering_seconds?: number | null
          character_count?: number | null
          client_info?: Json | null
          created_at?: string
          deadline_at?: string | null
          device_category?: string | null
          draft_revision?: number
          draft_saved_at?: string | null
          draft_text?: string
          effective_elapsed_seconds?: number | null
          first_watch_completed_at?: string | null
          first_watch_seconds?: number | null
          id?: string
          invalidated?: boolean
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          is_practice?: boolean
          observation_text?: string | null
          order_group_id?: string | null
          page_hidden_count?: number
          page_hidden_seconds?: number | null
          participant_id?: string
          pause_count?: number
          presentation_order?: number | null
          replay_count?: number
          seek_count?: number
          sentence_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["observation_status"]
          study_id?: string
          submission_type?:
            | Database["public"]["Enums"]["submission_type"]
            | null
          submitted_at?: string | null
          technical_issue?: boolean
          timed_out?: boolean
          updated_at?: string
          video_id?: string
          wall_elapsed_seconds?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_invalidated_by_fkey"
            columns: ["invalidated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      order_group_items: {
        Row: {
          id: string
          order_group_id: string
          position: number
          video_id: string
        }
        Insert: {
          id?: string
          order_group_id: string
          position: number
          video_id: string
        }
        Update: {
          id?: string
          order_group_id?: string
          position?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_group_items_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_group_items_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "order_group_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "order_group_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "order_group_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      order_groups: {
        Row: {
          code: string
          created_at: string
          generation: number
          group_index: number
          id: string
          study_id: string
          target_participants: number
        }
        Insert: {
          code: string
          created_at?: string
          generation?: number
          group_index: number
          id?: string
          study_id: string
          target_participants: number
        }
        Update: {
          code?: string
          created_at?: string
          generation?: number
          group_index?: number
          id?: string
          study_id?: string
          target_participants?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      participant_consents: {
        Row: {
          consent_type: string
          consent_version: string
          consented: boolean
          consented_at: string
          created_at: string
          id: string
          ip: unknown
          items_json: Json
          participant_id: string
          user_agent: string | null
        }
        Insert: {
          consent_type: string
          consent_version: string
          consented: boolean
          consented_at?: string
          created_at?: string
          id?: string
          ip?: unknown
          items_json?: Json
          participant_id: string
          user_agent?: string | null
        }
        Update: {
          consent_type?: string
          consent_version?: string
          consented?: boolean
          consented_at?: string
          created_at?: string
          id?: string
          ip?: unknown
          items_json?: Json
          participant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participant_demographics: {
        Row: {
          created_at: string
          current_child_age_group: string
          extra_json: Json
          generative_ai_experience: string
          id: string
          observation_record_frequency: string
          participant_id: string
          teaching_experience_months: number
          teaching_experience_years: number
          updated_at: string
          video_observation_experience: string
        }
        Insert: {
          created_at?: string
          current_child_age_group: string
          extra_json?: Json
          generative_ai_experience: string
          id?: string
          observation_record_frequency: string
          participant_id: string
          teaching_experience_months: number
          teaching_experience_years: number
          updated_at?: string
          video_observation_experience: string
        }
        Update: {
          created_at?: string
          current_child_age_group?: string
          extra_json?: Json
          generative_ai_experience?: string
          id?: string
          observation_record_frequency?: string
          participant_id?: string
          teaching_experience_months?: number
          teaching_experience_years?: number
          updated_at?: string
          video_observation_experience?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_demographics_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_demographics_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participant_order_assignments: {
        Row: {
          created_at: string
          id: string
          order_group_id: string
          participant_id: string
          presentation_order: number
          study_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_group_id: string
          participant_id: string
          presentation_order: number
          study_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_group_id?: string
          participant_id?: string
          presentation_order?: number
          study_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_order_assignments_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_order_assignments_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_order_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_order_assignments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "participant_order_assignments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_sessions: {
        Row: {
          expires_at: string
          id: string
          ip: unknown
          issued_at: string
          last_seen_at: string
          participant_id: string
          revoked_at: string | null
          user_agent: string | null
        }
        Insert: {
          expires_at: string
          id?: string
          ip?: unknown
          issued_at?: string
          last_seen_at?: string
          participant_id: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          ip?: unknown
          issued_at?: string
          last_seen_at?: string
          participant_id?: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participants: {
        Row: {
          browser_category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          device_category: string | null
          failed_pin_attempts: number
          guide_acknowledged_at: string | null
          id: string
          is_valid: boolean
          last_seen_at: string | null
          locked_until: string | null
          main_deadline_at: string | null
          notes_admin: string | null
          order_group_id: string
          participant_code: string
          pin_hash: string
          pin_updated_at: string
          practice_completed_at: string | null
          replaced_participant_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["participant_status"]
          study_id: string
          updated_at: string
          user_agent_first: string | null
        }
        Insert: {
          browser_category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          device_category?: string | null
          failed_pin_attempts?: number
          guide_acknowledged_at?: string | null
          id?: string
          is_valid?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          main_deadline_at?: string | null
          notes_admin?: string | null
          order_group_id: string
          participant_code: string
          pin_hash: string
          pin_updated_at?: string
          practice_completed_at?: string | null
          replaced_participant_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          study_id: string
          updated_at?: string
          user_agent_first?: string | null
        }
        Update: {
          browser_category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          device_category?: string | null
          failed_pin_attempts?: number
          guide_acknowledged_at?: string | null
          id?: string
          is_valid?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          main_deadline_at?: string | null
          notes_admin?: string | null
          order_group_id?: string
          participant_code?: string
          pin_hash?: string
          pin_updated_at?: string
          practice_completed_at?: string | null
          replaced_participant_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          study_id?: string
          updated_at?: string
          user_agent_first?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "participants_replaced_participant_id_fkey"
            columns: ["replaced_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_replaced_participant_id_fkey"
            columns: ["replaced_participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      reference_coder_records: {
        Row: {
          coder_id: string
          created_at: string
          event_payload: Json
          id: string
          round: number
          study_id: string
          video_id: string
        }
        Insert: {
          coder_id: string
          created_at?: string
          event_payload: Json
          id?: string
          round?: number
          study_id: string
          video_id: string
        }
        Update: {
          coder_id?: string
          created_at?: string
          event_payload?: Json
          id?: string
          round?: number
          study_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_coder_records_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_coder_records_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_coder_records_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_coder_records_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_coder_records_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_coder_records_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_coder_records_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_coder_records_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_event_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          operation: string
          reference_event_id: string
          snapshot: Json
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: number
          operation: string
          reference_event_id: string
          snapshot: Json
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: number
          operation?: string
          reference_event_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reference_event_versions_reference_event_id_fkey"
            columns: ["reference_event_id"]
            isOneToOne: false
            referencedRelation: "reference_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_event_versions_reference_event_id_fkey"
            columns: ["reference_event_id"]
            isOneToOne: false
            referencedRelation: "v_human_detection_rate"
            referencedColumns: ["reference_event_id"]
          },
        ]
      }
      reference_events: {
        Row: {
          action: string
          actor: string
          behavior_category: string | null
          body_part_or_tool: string | null
          coder_id: string | null
          created_at: string
          deleted_at: string | null
          end_ms: number | null
          event_code: string
          event_order: number
          id: string
          is_consensus: boolean
          notes: string | null
          object: string | null
          previous_event_id: string | null
          reference_sentence: string | null
          relation: string | null
          start_ms: number | null
          study_id: string
          temporal_relation: string | null
          updated_at: string
          video_id: string
        }
        Insert: {
          action: string
          actor: string
          behavior_category?: string | null
          body_part_or_tool?: string | null
          coder_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_ms?: number | null
          event_code: string
          event_order: number
          id?: string
          is_consensus?: boolean
          notes?: string | null
          object?: string | null
          previous_event_id?: string | null
          reference_sentence?: string | null
          relation?: string | null
          start_ms?: number | null
          study_id: string
          temporal_relation?: string | null
          updated_at?: string
          video_id: string
        }
        Update: {
          action?: string
          actor?: string
          behavior_category?: string | null
          body_part_or_tool?: string | null
          coder_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_ms?: number | null
          event_code?: string
          event_order?: number
          id?: string
          is_consensus?: boolean
          notes?: string | null
          object?: string | null
          previous_event_id?: string | null
          reference_sentence?: string | null
          relation?: string | null
          start_ms?: number | null
          study_id?: string
          temporal_relation?: string | null
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_events_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_events_previous_event_id_fkey"
            columns: ["previous_event_id"]
            isOneToOne: false
            referencedRelation: "reference_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_events_previous_event_id_fkey"
            columns: ["previous_event_id"]
            isOneToOne: false
            referencedRelation: "v_human_detection_rate"
            referencedColumns: ["reference_event_id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      response_claims: {
        Row: {
          char_end: number | null
          char_start: number | null
          claim_order: number
          claim_text: string
          coding_session_id: string
          created_at: string
          id: string
          source_record_id: string
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          claim_order: number
          claim_text: string
          coding_session_id: string
          created_at?: string
          id?: string
          source_record_id: string
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at?: string
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          claim_order?: number
          claim_text?: string
          coding_session_id?: string
          created_at?: string
          id?: string
          source_record_id?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_claims_coding_session_id_fkey"
            columns: ["coding_session_id"]
            isOneToOne: false
            referencedRelation: "coding_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          ai_runs_per_video: number
          code: string
          consent_version: string
          created_at: string
          first_watch_pause_enabled: boolean
          first_watch_seek_enabled: boolean
          first_watch_text_enabled: boolean
          id: string
          max_observation_seconds: number | null
          mobile_allowed: boolean
          name: string
          participant_target: number
          playback_rate: number
          practice_video_id: string | null
          replay_enabled: boolean
          research_video_count: number
          security_notice_version: string
          settings_locked_at: string | null
          status: Database["public"]["Enums"]["study_status"]
          structure_locked_at: string | null
          timer_mode: Database["public"]["Enums"]["timer_mode"]
          total_time_limit_seconds: number | null
          updated_at: string
          watermark_enabled: boolean
        }
        Insert: {
          ai_runs_per_video?: number
          code: string
          consent_version?: string
          created_at?: string
          first_watch_pause_enabled?: boolean
          first_watch_seek_enabled?: boolean
          first_watch_text_enabled?: boolean
          id?: string
          max_observation_seconds?: number | null
          mobile_allowed?: boolean
          name: string
          participant_target?: number
          playback_rate?: number
          practice_video_id?: string | null
          replay_enabled?: boolean
          research_video_count?: number
          security_notice_version?: string
          settings_locked_at?: string | null
          status?: Database["public"]["Enums"]["study_status"]
          structure_locked_at?: string | null
          timer_mode?: Database["public"]["Enums"]["timer_mode"]
          total_time_limit_seconds?: number | null
          updated_at?: string
          watermark_enabled?: boolean
        }
        Update: {
          ai_runs_per_video?: number
          code?: string
          consent_version?: string
          created_at?: string
          first_watch_pause_enabled?: boolean
          first_watch_seek_enabled?: boolean
          first_watch_text_enabled?: boolean
          id?: string
          max_observation_seconds?: number | null
          mobile_allowed?: boolean
          name?: string
          participant_target?: number
          playback_rate?: number
          practice_video_id?: string | null
          replay_enabled?: boolean
          research_video_count?: number
          security_notice_version?: string
          settings_locked_at?: string | null
          status?: Database["public"]["Enums"]["study_status"]
          structure_locked_at?: string | null
          timer_mode?: Database["public"]["Enums"]["timer_mode"]
          total_time_limit_seconds?: number | null
          updated_at?: string
          watermark_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "studies_practice_video_fk"
            columns: ["practice_video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "studies_practice_video_fk"
            columns: ["practice_video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "studies_practice_video_fk"
            columns: ["practice_video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      study_settings: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          setting_key: string
          study_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          setting_key: string
          study_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          setting_key?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_settings_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_settings_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "study_settings_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "study_settings_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      videos: {
        Row: {
          active: boolean
          activity_type: string | null
          actor_count: number | null
          age_group: string | null
          code: string
          complexity_level: string | null
          created_at: string
          description_admin: string | null
          duration_ms: number | null
          file_size_bytes: number | null
          has_audio: boolean
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["video_kind"]
          mime_type: string
          object_count: number | null
          sort_order: number
          storage_path: string | null
          study_id: string
          title_admin: string
          updated_at: string
          width: number | null
        }
        Insert: {
          active?: boolean
          activity_type?: string | null
          actor_count?: number | null
          age_group?: string | null
          code: string
          complexity_level?: string | null
          created_at?: string
          description_admin?: string | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          has_audio?: boolean
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["video_kind"]
          mime_type?: string
          object_count?: number | null
          sort_order?: number
          storage_path?: string | null
          study_id: string
          title_admin: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          active?: boolean
          activity_type?: string | null
          actor_count?: number | null
          age_group?: string | null
          code?: string
          complexity_level?: string | null
          created_at?: string
          description_admin?: string | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          has_audio?: boolean
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["video_kind"]
          mime_type?: string
          object_count?: number | null
          sort_order?: number
          storage_path?: string | null
          study_id?: string
          title_admin?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
    }
    Views: {
      v_analysis_summary: {
        Row: {
          avg_characters: number | null
          avg_effective_seconds: number | null
          avg_first_watch_seconds: number | null
          avg_pause: number | null
          avg_replay: number | null
          avg_seek: number | null
          avg_sentences: number | null
          avg_wall_seconds: number | null
          avg_words: number | null
          dimension: string | null
          key: string | null
          n: number | null
          study_id: string | null
          timeout_rate: number | null
        }
        Relationships: []
      }
      v_claim_metrics: {
        Row: {
          action_accuracy: number | null
          actor_accuracy: number | null
          claim_coded: number | null
          claim_total: number | null
          coder_id: string | null
          granularity_mean: number | null
          hallucination: number | null
          hallucination_rate: number | null
          inference_rate: number | null
          inference_supported: number | null
          inference_unsupported: number | null
          matched_events: number | null
          object_accuracy: number | null
          observed: number | null
          observed_unreferenced: number | null
          precision: number | null
          recall: number | null
          reference_total: number | null
          run_number: number | null
          session_status: string | null
          source_label: string | null
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          study_id: string | null
          temporal_fidelity: number | null
          unreferenced_rate: number | null
          unclear: number | null
          video_code: string | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coding_sessions_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_claim_metrics_full: {
        Row: {
          action_accuracy: number | null
          actor_accuracy: number | null
          claim_coded: number | null
          claim_total: number | null
          coder_id: string | null
          f1: number | null
          granularity_mean: number | null
          hallucination: number | null
          hallucination_rate: number | null
          inference_rate: number | null
          inference_supported: number | null
          inference_unsupported: number | null
          matched_events: number | null
          object_accuracy: number | null
          observed: number | null
          observed_unreferenced: number | null
          omission_rate: number | null
          precision: number | null
          recall: number | null
          reference_total: number | null
          run_number: number | null
          session_status: string | null
          source_label: string | null
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          study_id: string | null
          temporal_fidelity: number | null
          unreferenced_rate: number | null
          unclear: number | null
          video_code: string | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coding_sessions_coder_id_fkey"
            columns: ["coder_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "coding_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_coding_progress: {
        Row: {
          ai_finalized: number | null
          ai_sources: number | null
          reference_events: number | null
          study_id: string | null
          teacher_finalized: number | null
          teacher_sources: number | null
          video_code: string | null
          video_id: string | null
        }
        Insert: {
          ai_finalized?: never
          ai_sources?: never
          reference_events?: never
          study_id?: string | null
          teacher_finalized?: never
          teacher_sources?: never
          video_code?: string | null
          video_id?: string | null
        }
        Update: {
          ai_finalized?: never
          ai_sources?: never
          reference_events?: never
          study_id?: string | null
          teacher_finalized?: never
          teacher_sources?: never
          video_code?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      v_coding_sources: {
        Row: {
          character_count: number | null
          run_number: number | null
          source_label: string | null
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          study_id: string | null
          text: string | null
          video_code: string | null
          video_id: string | null
        }
        Relationships: []
      }
      v_dashboard_kpi: {
        Row: {
          ai_runs_total: number | null
          ai_videos_complete: number | null
          completed_participants: number | null
          data_collection_complete: boolean | null
          dropped_participants: number | null
          in_progress_observations: number | null
          in_progress_participants: number | null
          not_started_participants: number | null
          participant_target: number | null
          per_group_target: number | null
          reference_videos_done: number | null
          registered_participants: number | null
          research_videos_registered: number | null
          research_videos_uploaded: number | null
          status: Database["public"]["Enums"]["study_status"] | null
          structure_locked_at: string | null
          study_code: string | null
          study_id: string | null
          technical_issue_observations: number | null
          total_observation_target: number | null
          valid_observations: number | null
          video_count: number | null
        }
        Relationships: []
      }
      v_data_collection_complete: {
        Row: {
          complete: boolean | null
          completed_valid_participants: number | null
          every_group_complete: boolean | null
          every_video_complete: boolean | null
          participant_target: number | null
          study_id: string | null
          total_observation_target: number | null
          valid_observations: number | null
        }
        Insert: {
          complete?: never
          completed_valid_participants?: never
          every_group_complete?: never
          every_video_complete?: never
          participant_target?: number | null
          study_id?: string | null
          total_observation_target?: never
          valid_observations?: never
        }
        Update: {
          complete?: never
          completed_valid_participants?: never
          every_group_complete?: never
          every_video_complete?: never
          participant_target?: number | null
          study_id?: string | null
          total_observation_target?: never
          valid_observations?: never
        }
        Relationships: []
      }
      v_human_detection_rate: {
        Row: {
          action: string | null
          actor: string | null
          ai_coded_runs: number | null
          ai_detected: boolean | null
          ai_detected_runs: number | null
          behavior_category: string | null
          event_code: string | null
          event_order: number | null
          human_detection_rate: number | null
          object: string | null
          quadrant: string | null
          reference_event_id: string | null
          study_id: string | null
          teacher_coded: number | null
          teacher_detected: number | null
          teacher_valid_total: number | null
          video_code: string | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "reference_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_observation_metrics: {
        Row: {
          attempt_number: number | null
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          created_at: string | null
          deadline_at: string | null
          device_category: string | null
          draft_saved_at: string | null
          effective_elapsed_seconds: number | null
          expired: boolean | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          invalidated: boolean | null
          invalidated_reason: string | null
          is_practice: boolean | null
          limit_kind: string | null
          observation_id: string | null
          order_group: string | null
          page_hidden_count: number | null
          page_hidden_seconds: number | null
          participant_code: string | null
          participant_id: string | null
          participant_valid: boolean | null
          pause_count: number | null
          presentation_order: number | null
          remaining_seconds: number | null
          replay_count: number | null
          seek_count: number | null
          sentence_count: number | null
          started_after_total_deadline: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"] | null
          study_id: string | null
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean | null
          timed_out: boolean | null
          total_deadline_at: string | null
          total_remaining_seconds: number | null
          updated_at: string | null
          video_code: string | null
          video_id: string | null
          video_title: string | null
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_balance_check: {
        Row: {
          actual: number | null
          check_name: string | null
          detail: Json | null
          expected: number | null
          pass: boolean | null
          study_id: string | null
        }
        Relationships: []
      }
      v_order_group_balance: {
        Row: {
          assigned_valid: number | null
          code: string | null
          completed_valid: number | null
          dropped: number | null
          generation: number | null
          group_index: number | null
          order_group_id: string | null
          sequence: string | null
          study_id: string | null
          target_participants: number | null
        }
        Insert: {
          assigned_valid?: never
          code?: string | null
          completed_valid?: never
          dropped?: never
          generation?: number | null
          group_index?: number | null
          order_group_id?: string | null
          sequence?: never
          study_id?: string | null
          target_participants?: number | null
        }
        Update: {
          assigned_valid?: never
          code?: string | null
          completed_valid?: never
          dropped?: never
          generation?: number | null
          group_index?: number | null
          order_group_id?: string | null
          sequence?: never
          study_id?: string | null
          target_participants?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "order_groups_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      v_participant_progress: {
        Row: {
          avg_effective_seconds: number | null
          avg_wall_seconds: number | null
          browser_category: string | null
          completed_at: string | null
          completed_count: number | null
          created_at: string | null
          device_category: string | null
          guide_acknowledged_at: string | null
          has_consent: boolean | null
          has_demographics: boolean | null
          has_in_progress: boolean | null
          has_technical_issue: boolean | null
          is_valid: boolean | null
          last_seen_at: string | null
          main_deadline_at: string | null
          notes_admin: string | null
          order_group: string | null
          order_group_id: string | null
          participant_code: string | null
          participant_id: string | null
          practice_completed_at: string | null
          replaced_participant_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["participant_status"] | null
          study_id: string | null
          target_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "participants_replaced_participant_id_fkey"
            columns: ["replaced_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_replaced_participant_id_fkey"
            columns: ["replaced_participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      v_research_master: {
        Row: {
          attempt_number: number | null
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          device_category: string | null
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          invalidated: boolean | null
          invalidated_reason: string | null
          is_valid_record: boolean | null
          main_deadline_at: string | null
          observation_id: string | null
          observation_text: string | null
          order_group: string | null
          page_hidden_count: number | null
          page_hidden_seconds: number | null
          participant_code: string | null
          participant_started_at: string | null
          participant_status:
            | Database["public"]["Enums"]["participant_status"]
            | null
          participant_valid: boolean | null
          pause_count: number | null
          presentation_order: number | null
          replay_count: number | null
          seconds_since_participant_start: number | null
          seek_count: number | null
          sentence_count: number | null
          started_after_total_deadline: boolean | null
          started_at: string | null
          study_id: string | null
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean | null
          timed_out: boolean | null
          video_code: string | null
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
      v_study_targets: {
        Row: {
          balanced_possible: boolean | null
          participant_target: number | null
          per_group_target: number | null
          status: Database["public"]["Enums"]["study_status"] | null
          structure_locked_at: string | null
          study_code: string | null
          study_id: string | null
          total_observation_target: number | null
          video_count: number | null
        }
        Insert: {
          balanced_possible?: never
          participant_target?: number | null
          per_group_target?: never
          status?: Database["public"]["Enums"]["study_status"] | null
          structure_locked_at?: string | null
          study_code?: string | null
          study_id?: string | null
          total_observation_target?: never
          video_count?: number | null
        }
        Update: {
          balanced_possible?: never
          participant_target?: number | null
          per_group_target?: never
          status?: Database["public"]["Enums"]["study_status"] | null
          structure_locked_at?: string | null
          study_code?: string | null
          study_id?: string | null
          total_observation_target?: never
          video_count?: number | null
        }
        Relationships: []
      }
      v_valid_observations: {
        Row: {
          attempt_number: number | null
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string | null
          deadline_at: string | null
          device_category: string | null
          draft_revision: number | null
          draft_saved_at: string | null
          draft_text: string | null
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string | null
          invalidated: boolean | null
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean | null
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number | null
          page_hidden_seconds: number | null
          participant_id: string | null
          pause_count: number | null
          presentation_order: number | null
          replay_count: number | null
          seek_count: number | null
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"] | null
          study_id: string | null
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean | null
          timed_out: boolean | null
          updated_at: string | null
          video_id: string | null
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_invalidated_by_fkey"
            columns: ["invalidated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "order_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_order_group_id_fkey"
            columns: ["order_group_id"]
            isOneToOne: false
            referencedRelation: "v_order_group_balance"
            referencedColumns: ["order_group_id"]
          },
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_participant_progress"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_coding_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_progress"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_video_progress: {
        Row: {
          code: string | null
          invalidated_count: number | null
          sort_order: number | null
          study_id: string | null
          target_count: number | null
          title_admin: string | null
          valid_count: number | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_data_collection_complete"
            referencedColumns: ["study_id"]
          },
          {
            foreignKeyName: "videos_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "v_study_targets"
            referencedColumns: ["study_id"]
          },
        ]
      }
    }
    Functions: {
      app_admin_id: { Args: never; Returns: string }
      app_setting: { Args: { p_key: string }; Returns: string }
      change_order_group: {
        Args: {
          p_admin_id: string
          p_new_group_id: string
          p_participant_id: string
          p_reason: string
        }
        Returns: {
          browser_category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          device_category: string | null
          failed_pin_attempts: number
          guide_acknowledged_at: string | null
          id: string
          is_valid: boolean
          last_seen_at: string | null
          locked_until: string | null
          main_deadline_at: string | null
          notes_admin: string | null
          order_group_id: string
          participant_code: string
          pin_hash: string
          pin_updated_at: string
          practice_completed_at: string | null
          replaced_participant_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["participant_status"]
          study_id: string
          updated_at: string
          user_agent_first: string | null
        }
        SetofOptions: {
          from: "*"
          to: "participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_first_watch: {
        Args: {
          p_at?: string
          p_max_watched_ms?: number
          p_observation_id: string
        }
        Returns: {
          attempt_number: number
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string
          deadline_at: string | null
          device_category: string | null
          draft_revision: number
          draft_saved_at: string | null
          draft_text: string
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number
          page_hidden_seconds: number | null
          participant_id: string
          pause_count: number
          presentation_order: number | null
          replay_count: number
          seek_count: number
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean
          timed_out: boolean
          updated_at: string
          video_id: string
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "observations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_text_stats: {
        Args: { p_text: string }
        Returns: {
          character_count: number
          sentence_count: number
          word_count: number
        }[]
      }
      create_assignments_for_participant: {
        Args: { p_participant_id: string }
        Returns: number
      }
      create_participant_with_assignments: {
        Args: {
          p_admin_id: string
          p_code: string
          p_notes?: string
          p_order_group_id: string
          p_pin_hash: string
          p_replaced_participant_id?: string
          p_study_id: string
        }
        Returns: {
          browser_category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          device_category: string | null
          failed_pin_attempts: number
          guide_acknowledged_at: string | null
          id: string
          is_valid: boolean
          last_seen_at: string | null
          locked_until: string | null
          main_deadline_at: string | null
          notes_admin: string | null
          order_group_id: string
          participant_code: string
          pin_hash: string
          pin_updated_at: string
          practice_completed_at: string | null
          replaced_participant_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["participant_status"]
          study_id: string
          updated_at: string
          user_agent_first: string | null
        }
        SetofOptions: {
          from: "*"
          to: "participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_practice_observation: {
        Args: { p_participant_id: string }
        Returns: string
      }
      finalize_expired_observations: {
        Args: { p_now?: string; p_participant_id?: string }
        Returns: number
      }
      ingest_observation_events: {
        Args: {
          p_client_now?: string
          p_events: Json
          p_observation_id: string
          p_server_now?: string
        }
        Returns: number
      }
      invalidate_and_retry: {
        Args: {
          p_admin_id: string
          p_create_retry?: boolean
          p_observation_id: string
          p_reason: string
        }
        Returns: {
          attempt_number: number
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string
          deadline_at: string | null
          device_category: string | null
          draft_revision: number
          draft_saved_at: string | null
          draft_text: string
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number
          page_hidden_seconds: number | null
          participant_id: string
          pause_count: number
          presentation_order: number | null
          replay_count: number
          seek_count: number
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean
          timed_out: boolean
          updated_at: string
          video_id: string
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "observations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      observation_buffering_seconds: {
        Args: { p_now?: string; p_observation_id: string }
        Returns: number
      }
      observation_timer_state: {
        Args: { p_now?: string; p_observation_id: string }
        Returns: {
          buffering_seconds: number
          effective_elapsed_seconds: number
          expired: boolean
          limit_kind: string
          max_seconds: number
          remaining_seconds: number
          started_after_total_deadline: boolean
          started_at: string
          submitted: boolean
          timer_mode: Database["public"]["Enums"]["timer_mode"]
          total_deadline_at: string
          total_remaining_seconds: number
          wall_elapsed_seconds: number
        }[]
      }
      record_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_admin_id: string
          p_after?: Json
          p_before?: Json
          p_study_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      record_server_event: {
        Args: {
          p_at?: string
          p_metadata?: Json
          p_observation_id: string
          p_type: Database["public"]["Enums"]["event_type"]
          p_video_ms?: number
        }
        Returns: number
      }
      regenerate_order_groups: {
        Args: { p_admin_id: string; p_study_id: string }
        Returns: number
      }
      reset_participant_pin: {
        Args: {
          p_admin_id: string
          p_participant_id: string
          p_pin_hash: string
        }
        Returns: undefined
      }
      save_observation_draft: {
        Args: {
          p_at?: string
          p_observation_id: string
          p_revision: number
          p_text: string
        }
        Returns: number
      }
      set_study_status: {
        Args: {
          p_admin_id: string
          p_new_status: Database["public"]["Enums"]["study_status"]
          p_reason?: string
          p_study_id: string
        }
        Returns: {
          ai_runs_per_video: number
          code: string
          consent_version: string
          created_at: string
          first_watch_pause_enabled: boolean
          first_watch_seek_enabled: boolean
          first_watch_text_enabled: boolean
          id: string
          max_observation_seconds: number | null
          mobile_allowed: boolean
          name: string
          participant_target: number
          playback_rate: number
          practice_video_id: string | null
          replay_enabled: boolean
          research_video_count: number
          security_notice_version: string
          settings_locked_at: string | null
          status: Database["public"]["Enums"]["study_status"]
          structure_locked_at: string | null
          timer_mode: Database["public"]["Enums"]["timer_mode"]
          total_time_limit_seconds: number | null
          updated_at: string
          watermark_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "studies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_observation: {
        Args: { p_observation_id: string; p_started_at?: string }
        Returns: {
          attempt_number: number
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string
          deadline_at: string | null
          device_category: string | null
          draft_revision: number
          draft_saved_at: string | null
          draft_text: string
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number
          page_hidden_seconds: number | null
          participant_id: string
          pause_count: number
          presentation_order: number | null
          replay_count: number
          seek_count: number
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean
          timed_out: boolean
          updated_at: string
          video_id: string
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "observations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      study_is_locked: { Args: { p_study_id: string }; Returns: boolean }
      study_targets: {
        Args: { p_study_id: string }
        Returns: {
          balanced_possible: boolean
          participant_target: number
          per_group_target: number
          total_observation_target: number
          video_count: number
        }[]
      }
      submit_observation: {
        Args: {
          p_now?: string
          p_observation_id: string
          p_type: Database["public"]["Enums"]["submission_type"]
        }
        Returns: {
          attempt_number: number
          browser_category: string | null
          buffering_seconds: number | null
          character_count: number | null
          client_info: Json | null
          created_at: string
          deadline_at: string | null
          device_category: string | null
          draft_revision: number
          draft_saved_at: string | null
          draft_text: string
          effective_elapsed_seconds: number | null
          first_watch_completed_at: string | null
          first_watch_seconds: number | null
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          is_practice: boolean
          observation_text: string | null
          order_group_id: string | null
          page_hidden_count: number
          page_hidden_seconds: number | null
          participant_id: string
          pause_count: number
          presentation_order: number | null
          replay_count: number
          seek_count: number
          sentence_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["observation_status"]
          study_id: string
          submission_type: Database["public"]["Enums"]["submission_type"] | null
          submitted_at: string | null
          technical_issue: boolean
          timed_out: boolean
          updated_at: string
          video_id: string
          wall_elapsed_seconds: number | null
          word_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "observations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_study_settings: {
        Args: {
          p_admin_id: string
          p_patch: Json
          p_reason?: string
          p_study_id: string
        }
        Returns: {
          ai_runs_per_video: number
          code: string
          consent_version: string
          created_at: string
          first_watch_pause_enabled: boolean
          first_watch_seek_enabled: boolean
          first_watch_text_enabled: boolean
          id: string
          max_observation_seconds: number | null
          mobile_allowed: boolean
          name: string
          participant_target: number
          playback_rate: number
          practice_video_id: string | null
          replay_enabled: boolean
          research_video_count: number
          security_notice_version: string
          settings_locked_at: string | null
          status: Database["public"]["Enums"]["study_status"]
          structure_locked_at: string | null
          timer_mode: Database["public"]["Enums"]["timer_mode"]
          total_time_limit_seconds: number | null
          updated_at: string
          watermark_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "studies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_participant: {
        Args: {
          p_admin_id: string
          p_participant_id: string
          p_reason: string
          p_status?: Database["public"]["Enums"]["participant_status"]
        }
        Returns: {
          browser_category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          device_category: string | null
          failed_pin_attempts: number
          guide_acknowledged_at: string | null
          id: string
          is_valid: boolean
          last_seen_at: string | null
          locked_until: string | null
          main_deadline_at: string | null
          notes_admin: string | null
          order_group_id: string
          participant_code: string
          pin_hash: string
          pin_updated_at: string
          practice_completed_at: string | null
          replaced_participant_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["participant_status"]
          study_id: string
          updated_at: string
          user_agent_first: string | null
        }
        SetofOptions: {
          from: "*"
          to: "participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      accuracy_level: "correct" | "partial" | "incorrect" | "not_applicable"
      audit_action:
        | "study_setting_changed"
        | "study_status_changed"
        | "video_uploaded"
        | "video_replaced"
        | "video_updated"
        | "participant_created"
        | "participant_updated"
        | "participant_order_group_assigned"
        | "participant_pin_reset"
        | "participant_reset"
        | "participant_withdrawn"
        | "observation_invalidated"
        | "observation_retry_created"
        | "order_groups_regenerated"
        | "reference_event_created"
        | "reference_event_updated"
        | "reference_event_deleted"
        | "ai_prompt_created"
        | "ai_prompt_updated"
        | "ai_run_created"
        | "ai_run_updated"
        | "claim_created"
        | "claim_updated"
        | "claim_coding_created"
        | "claim_coding_updated"
        | "data_exported"
      event_type:
        | "observation_started"
        | "video_first_play_started"
        | "video_first_play_completed"
        | "video_play"
        | "video_pause"
        | "video_seek"
        | "video_ended"
        | "video_buffer_start"
        | "video_buffer_end"
        | "video_error"
        | "page_hidden"
        | "page_visible"
        | "network_offline"
        | "network_online"
        | "draft_saved"
        | "observation_submitted"
        | "timeout_submitted"
        | "first_watch_blocked_action"
        | "first_watch_restarted"
      observation_status:
        | "pending"
        | "in_progress"
        | "submitted"
        | "invalidated"
      participant_status:
        | "invited"
        | "consented"
        | "onboarding"
        | "practice_completed"
        | "in_progress"
        | "completed"
        | "withdrawn"
        | "technical_issue"
      source_type: "teacher" | "ai"
      study_status:
        | "draft"
        | "pilot"
        | "ready"
        | "active"
        | "paused"
        | "closed"
        | "archived"
      submission_type: "manual" | "timeout"
      support_type:
        | "observed"
        | "inference_supported"
        | "inference_unsupported"
        | "hallucination"
        | "observed_unreferenced"
        | "unclear"
      timer_mode: "wall_time" | "effective_time"
      video_kind: "research" | "practice"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      accuracy_level: ["correct", "partial", "incorrect", "not_applicable"],
      audit_action: [
        "study_setting_changed",
        "study_status_changed",
        "video_uploaded",
        "video_replaced",
        "video_updated",
        "participant_created",
        "participant_updated",
        "participant_order_group_assigned",
        "participant_pin_reset",
        "participant_reset",
        "participant_withdrawn",
        "observation_invalidated",
        "observation_retry_created",
        "order_groups_regenerated",
        "reference_event_created",
        "reference_event_updated",
        "reference_event_deleted",
        "ai_prompt_created",
        "ai_prompt_updated",
        "ai_run_created",
        "ai_run_updated",
        "claim_created",
        "claim_updated",
        "claim_coding_created",
        "claim_coding_updated",
        "data_exported",
      ],
      event_type: [
        "observation_started",
        "video_first_play_started",
        "video_first_play_completed",
        "video_play",
        "video_pause",
        "video_seek",
        "video_ended",
        "video_buffer_start",
        "video_buffer_end",
        "video_error",
        "page_hidden",
        "page_visible",
        "network_offline",
        "network_online",
        "draft_saved",
        "observation_submitted",
        "timeout_submitted",
        "first_watch_blocked_action",
        "first_watch_restarted",
      ],
      observation_status: [
        "pending",
        "in_progress",
        "submitted",
        "invalidated",
      ],
      participant_status: [
        "invited",
        "consented",
        "onboarding",
        "practice_completed",
        "in_progress",
        "completed",
        "withdrawn",
        "technical_issue",
      ],
      source_type: ["teacher", "ai"],
      study_status: [
        "draft",
        "pilot",
        "ready",
        "active",
        "paused",
        "closed",
        "archived",
      ],
      submission_type: ["manual", "timeout"],
      support_type: [
        "observed",
        "inference_supported",
        "inference_unsupported",
        "hallucination",
        "unclear",
      ],
      timer_mode: ["wall_time", "effective_time"],
      video_kind: ["research", "practice"],
    },
  },
} as const

