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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      communities: {
        Row: {
          avatar_url: string | null
          community_type: Database["public"]["Enums"]["community_type"]
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          member_count: number | null
          name: string
          post_count: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          community_type?: Database["public"]["Enums"]["community_type"]
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          member_count?: number | null
          name: string
          post_count?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          community_type?: Database["public"]["Enums"]["community_type"]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          member_count?: number | null
          name?: string
          post_count?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_invites: {
        Row: {
          community_id: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_user_id: string | null
          status: string
        }
        Insert: {
          community_id: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          invited_user_id?: string | null
          status?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          caption: string | null
          comments_count: number | null
          community_id: string
          created_at: string
          id: string
          likes_count: number | null
          saves_count: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          community_id: string
          created_at?: string
          id?: string
          likes_count?: number | null
          saves_count?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          community_id?: string
          created_at?: string
          id?: string
          likes_count?: number | null
          saves_count?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          related_outfit_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          related_outfit_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          related_outfit_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_outfit_id_fkey"
            columns: ["related_outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_analysis_cache: {
        Row: {
          cache_key: string
          created_at: string
          id: string
          result: Json
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          id?: string
          result: Json
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      outfit_analysis_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          image_data: string
          position: number | null
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          image_data: string
          position?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          image_data?: string
          position?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      outfit_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          outfit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          outfit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          outfit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_comments_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_likes: {
        Row: {
          created_at: string
          id: string
          outfit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_likes_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          likes_count: number | null
          rating: number | null
          style_tags: string[] | null
          trend_match_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          likes_count?: number | null
          rating?: number | null
          style_tags?: string[] | null
          trend_match_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          likes_count?: number | null
          rating?: number | null
          style_tags?: string[] | null
          trend_match_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          post_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          post_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          tagged_by: string
          tagged_user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          tagged_by: string
          tagged_user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          tagged_by?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "outfit_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          public_followers: boolean | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id: string
          public_followers?: boolean | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          public_followers?: boolean | null
          username?: string
        }
        Relationships: []
      }
      saved_collections: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          post_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          post_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          post_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          collection_id: string
          id: string
          post_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          collection_id: string
          id?: string
          post_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          id?: string
          post_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "saved_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_detected_items: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          id: string
          item_name: string
          matches_trend: string | null
          trend_score: number
          video_id: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          id?: string
          item_name: string
          matches_trend?: string | null
          trend_score: number
          video_id: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          item_name?: string
          matches_trend?: string | null
          trend_score?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_detected_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "tiktok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_hashtags: {
        Row: {
          created_at: string
          hashtag: string
          id: string
          is_common: boolean | null
          last_scraped_at: string
          video_count: number | null
        }
        Insert: {
          created_at?: string
          hashtag: string
          id?: string
          is_common?: boolean | null
          last_scraped_at?: string
          video_count?: number | null
        }
        Update: {
          created_at?: string
          hashtag?: string
          id?: string
          is_common?: boolean | null
          last_scraped_at?: string
          video_count?: number | null
        }
        Relationships: []
      }
      tiktok_videos: {
        Row: {
          author: string | null
          created_at: string
          description: string | null
          hashtag: string
          id: string
          overall_trend_score: number | null
          percentile: number | null
          rank: number | null
          thumbnail_url: string | null
          updated_at: string
          video_id: string
          video_url: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          description?: string | null
          hashtag: string
          id?: string
          overall_trend_score?: number | null
          percentile?: number | null
          rank?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          video_id: string
          video_url: string
        }
        Update: {
          author?: string | null
          created_at?: string
          description?: string | null
          hashtag?: string
          id?: string
          overall_trend_score?: number | null
          percentile?: number | null
          rank?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          video_id?: string
          video_url?: string
        }
        Relationships: []
      }
      trend_history: {
        Row: {
          created_at: string
          id: string
          popularity_score: number
          recorded_at: string
          trend_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          popularity_score?: number
          recorded_at?: string
          trend_id: string
        }
        Update: {
          created_at?: string
          id?: string
          popularity_score?: number
          recorded_at?: string
          trend_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_history_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          popularity_score: number | null
          source: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          popularity_score?: number | null
          source?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          popularity_score?: number | null
          source?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          outfit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          outfit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          age_range: string | null
          created_at: string
          gender: string | null
          id: string
          style_preferences: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          style_preferences?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_range?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          style_preferences?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_conversation_for_users: {
        Args: { user_id_1: string; user_id_2: string }
        Returns: string
      }
      test_conversation_creation: {
        Args: never
        Returns: {
          conversation_id: string
          error_message: string
          success: boolean
        }[]
      }
      user_has_access_to_conversation: {
        Args: { conversation_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      community_role: "owner" | "admin" | "member"
      community_type: "public" | "invite_only"
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
      community_role: ["owner", "admin", "member"],
      community_type: ["public", "invite_only"],
    },
  },
} as const
