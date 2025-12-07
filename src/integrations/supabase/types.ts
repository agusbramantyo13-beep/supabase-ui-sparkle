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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string | null
          id: string
          notes: string | null
          selfie_url: string | null
          user_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          selfie_url?: string | null
          user_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          selfie_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          active: boolean | null
          applies_to: Database["public"]["Enums"]["applies_to"]
          created_at: string | null
          created_by: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          target_id: string | null
          value: number
        }
        Insert: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          target_id?: string | null
          value: number
        }
        Update: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          target_id?: string | null
          value?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: number
          quantity: number
          updated_at: string | null
          variant_id: number | null
        }
        Insert: {
          id?: number
          quantity?: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Update: {
          id?: number
          quantity?: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_point_rules: {
        Row: {
          active: boolean | null
          applies_to: Database["public"]["Enums"]["applies_to"]
          created_at: string | null
          created_by: string | null
          id: string
          min_purchase: number
          name: string
          points_earned: number
          target_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          min_purchase?: number
          name: string
          points_earned?: number
          target_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          min_purchase?: number
          name?: string
          points_earned?: number
          target_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          id: string
          member_code: string | null
          name: string
          phone: string | null
          points: number | null
          status: string | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          id?: string
          member_code?: string | null
          name: string
          phone?: string | null
          points?: number | null
          status?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          id?: string
          member_code?: string | null
          name?: string
          phone?: string | null
          points?: number | null
          status?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: number
          order_id: number | null
          price: number
          quantity: number
          variant_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          order_id?: number | null
          price: number
          quantity: number
          variant_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          order_id?: number | null
          price?: number
          quantity?: number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          id: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          cost_price: number
          created_at: string | null
          id: string
          product_snapshot: Json
          quantity: number
          selling_price: number
          session_id: string
          total_cost: number
          variant_id: number | null
        }
        Insert: {
          cost_price: number
          created_at?: string | null
          id?: string
          product_snapshot: Json
          quantity: number
          selling_price: number
          session_id: string
          total_cost: number
          variant_id?: number | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          id?: string
          product_snapshot?: Json
          quantity?: number
          selling_price?: number
          session_id?: string
          total_cost?: number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "purchase_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          purchase_date: string
          returned_at: string | null
          returned_by: string | null
          status: string | null
          supplier: string
          total_cost: number
          total_items: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date: string
          returned_at?: string | null
          returned_by?: string | null
          status?: string | null
          supplier: string
          total_cost?: number
          total_items?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          returned_at?: string | null
          returned_by?: string | null
          status?: string | null
          supplier?: string
          total_cost?: number
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          discount: number
          id: string
          product_snapshot: Json
          quantity: number
          sale_id: string
          total: number
          unit_price: number
          variant_id: number | null
        }
        Insert: {
          cost_price: number
          discount?: number
          id?: string
          product_snapshot: Json
          quantity?: number
          sale_id: string
          total: number
          unit_price: number
          variant_id?: number | null
        }
        Update: {
          cost_price?: number
          discount?: number
          id?: string
          product_snapshot?: Json
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string | null
          discount_total: number
          id: string
          payment_details: Json | null
          payment_method: string | null
          receipt_number: string | null
          shift_id: string | null
          subtotal: number
          tax_total: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_total?: number
          id?: string
          payment_details?: Json | null
          payment_method?: string | null
          receipt_number?: string | null
          shift_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_total?: number
          id?: string
          payment_details?: Json | null
          payment_method?: string | null
          receipt_number?: string | null
          shift_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          id: string
          note: string | null
          opened_at: string | null
          opened_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          opened_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          opened_by?: string | null
        }
        Relationships: []
      }
      stock_adjustment_items: {
        Row: {
          created_at: string | null
          id: string
          new_quantity: number
          old_quantity: number
          quantity_difference: number
          session_id: string
          total_value_difference: number
          unit_value: number
          variant_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_quantity?: number
          old_quantity?: number
          quantity_difference?: number
          session_id: string
          total_value_difference?: number
          unit_value?: number
          variant_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          new_quantity?: number
          old_quantity?: number
          quantity_difference?: number
          session_id?: string
          total_value_difference?: number
          unit_value?: number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          status: string | null
          total_value_difference: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string | null
          total_value_difference?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string | null
          total_value_difference?: number | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          movement: Database["public"]["Enums"]["movement_type"]
          quantity: number
          variant_id: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          movement: Database["public"]["Enums"]["movement_type"]
          quantity: number
          variant_id?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          movement?: Database["public"]["Enums"]["movement_type"]
          quantity?: number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_items: {
        Row: {
          counted_qty: number
          difference: number | null
          expected_qty: number
          id: string
          note: string | null
          session_id: string
          variant_id: string
        }
        Insert: {
          counted_qty: number
          difference?: number | null
          expected_qty: number
          id?: string
          note?: string | null
          session_id: string
          variant_id: string
        }
        Update: {
          counted_qty?: number
          difference?: number | null
          expected_qty?: number
          id?: string
          note?: string | null
          session_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_opname_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_sessions: {
        Row: {
          closed_at: string | null
          id: string
          note: string | null
          performed_by: string | null
          started_at: string | null
        }
        Insert: {
          closed_at?: string | null
          id?: string
          note?: string | null
          performed_by?: string | null
          started_at?: string | null
        }
        Update: {
          closed_at?: string | null
          id?: string
          note?: string | null
          performed_by?: string | null
          started_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          cost_price: number
          created_at: string | null
          id: number
          name: string
          price: number
          product_id: number | null
          sku: string | null
        }
        Insert: {
          cost_price?: number
          created_at?: string | null
          id?: number
          name: string
          price: number
          product_id?: number | null
          sku?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          id?: number
          name?: string
          price?: number
          product_id?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_current_inventory: {
        Row: {
          category_name: string | null
          product_name: string | null
          quantity: number | null
          variant_id: number | null
          variant_name: string | null
        }
        Relationships: []
      }
      v_profit_by_date: {
        Row: {
          day: string | null
          profit: number | null
        }
        Relationships: []
      }
      v_sales_summary: {
        Row: {
          day: string | null
          receipts: number | null
          total_discounts: number | null
          total_sales: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_member_code: { Args: never; Returns: string }
    }
    Enums: {
      applies_to: "global" | "product" | "variant" | "category"
      discount_type: "percentage" | "fixed"
      movement_type: "in" | "out"
      user_role: "owner" | "store_keeper"
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
      applies_to: ["global", "product", "variant", "category"],
      discount_type: ["percentage", "fixed"],
      movement_type: ["in", "out"],
      user_role: ["owner", "store_keeper"],
    },
  },
} as const
