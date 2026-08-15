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
          store_id: string | null
          user_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          selfie_url?: string | null
          store_id?: string | null
          user_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          selfie_url?: string | null
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      bundle_promo_buy_items: {
        Row: {
          bundle_id: string
          created_at: string | null
          id: string
          quantity: number
          variant_id: number
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          id?: string
          quantity?: number
          variant_id: number
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          id?: string
          quantity?: number
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_promo_buy_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundle_promos"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_promo_free_items: {
        Row: {
          bundle_id: string
          created_at: string | null
          id: string
          quantity: number
          variant_id: number
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          id?: string
          quantity?: number
          variant_id: number
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          id?: string
          quantity?: number
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_promo_free_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundle_promos"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_promos: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_deposits: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deposit_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          status: string
          store_id: string | null
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          store_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          store_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_deposits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          min_purchase: number
          min_quantity: number
          name: string
          starts_at: string | null
          store_id: string | null
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
          min_purchase?: number
          min_quantity?: number
          name: string
          starts_at?: string | null
          store_id?: string | null
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
          min_purchase?: number
          min_quantity?: number
          name?: string
          starts_at?: string | null
          store_id?: string | null
          target_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: number
          quantity: number
          store_id: string | null
          updated_at: string | null
          variant_id: number | null
        }
        Insert: {
          id?: number
          quantity?: number
          store_id?: string | null
          updated_at?: string | null
          variant_id?: number | null
        }
        Update: {
          id?: number
          quantity?: number
          store_id?: string | null
          updated_at?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
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
          is_multiple: boolean
          min_purchase: number
          name: string
          points_earned: number
          store_id: string | null
          target_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_multiple?: boolean
          min_purchase?: number
          name: string
          points_earned?: number
          store_id?: string | null
          target_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_multiple?: boolean
          min_purchase?: number
          name?: string
          points_earned?: number
          store_id?: string | null
          target_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_point_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          {
            foreignKeyName: "members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          store_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          store_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          store_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      other_sales: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          sale_date: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          sale_date?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          sale_date?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      point_redemption_rules: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          max_discount: number | null
          min_purchase: number | null
          name: string
          points_required: number
          reward_type: string
          reward_value: number
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          name: string
          points_required?: number
          reward_type?: string
          reward_value?: number
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          name?: string
          points_required?: number
          reward_type?: string
          reward_value?: number
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_redemption_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number | null
          created_at: string | null
          has_variants: boolean
          id: number
          image_path: string | null
          name: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          has_variants?: boolean
          id?: number
          image_path?: string | null
          name: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          has_variants?: boolean
          id?: number
          image_path?: string | null
          name?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          theme: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          {
            foreignKeyName: "purchase_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_profit"
            referencedColumns: ["sale_id"]
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
          member_id: string | null
          member_points_after: number | null
          payment_details: Json | null
          payment_method: string | null
          receipt_number: string | null
          returned_at: string | null
          returned_by: string | null
          shift_id: string | null
          status: string | null
          store_id: string | null
          subtotal: number
          tax_total: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_total?: number
          id?: string
          member_id?: string | null
          member_points_after?: number | null
          payment_details?: Json | null
          payment_method?: string | null
          receipt_number?: string | null
          returned_at?: string | null
          returned_by?: string | null
          shift_id?: string | null
          status?: string | null
          store_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_total?: number
          id?: string
          member_id?: string | null
          member_points_after?: number | null
          payment_details?: Json | null
          payment_method?: string | null
          receipt_number?: string | null
          returned_at?: string | null
          returned_by?: string | null
          shift_id?: string | null
          status?: string | null
          store_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          store_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          opened_by?: string | null
          store_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          opened_by?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          store_id: string | null
          total_value_difference: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string | null
          store_id?: string | null
          total_value_difference?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string | null
          store_id?: string | null
          total_value_difference?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_history: {
        Row: {
          created_at: string
          id: number
          movement_type: Database["public"]["Enums"]["stock_history_type"]
          notes: string | null
          product_id: number | null
          product_name: string
          qty_after: number
          qty_before: number
          qty_change: number
          store_id: string
          user_id: string | null
          user_name: string | null
          variant_id: number | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          movement_type: Database["public"]["Enums"]["stock_history_type"]
          notes?: string | null
          product_id?: number | null
          product_name: string
          qty_after?: number
          qty_before?: number
          qty_change?: number
          store_id: string
          user_id?: string | null
          user_name?: string | null
          variant_id?: number | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          movement_type?: Database["public"]["Enums"]["stock_history_type"]
          notes?: string | null
          product_id?: number | null
          product_name?: string
          qty_after?: number
          qty_before?: number
          qty_change?: number
          store_id?: string
          user_id?: string | null
          user_name?: string | null
          variant_id?: number | null
          variant_name?: string | null
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
          store_id: string | null
          variant_id: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          movement: Database["public"]["Enums"]["movement_type"]
          quantity: number
          store_id?: string | null
          variant_id?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          movement?: Database["public"]["Enums"]["movement_type"]
          quantity?: number
          store_id?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
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
      stock_transfer_items: {
        Row: {
          created_at: string | null
          id: string
          product_name: string
          quantity: number
          transfer_id: string
          variant_id: number | null
          variant_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_name: string
          quantity: number
          transfer_id: string
          variant_id?: number | null
          variant_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_name?: string
          quantity?: number
          transfer_id?: string
          variant_id?: number | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_current_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_store_id: string
          id: string
          notes: string | null
          status: string
          to_store_id: string
          transfer_number: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_store_id: string
          id?: string
          notes?: string | null
          status?: string
          to_store_id: string
          transfer_number?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_store_id?: string
          id?: string
          notes?: string | null
          status?: string
          to_store_id?: string
          transfer_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          status: string
          store_id: string | null
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          store_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          store_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
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
          average_cost: number | null
          cost_price: number
          created_at: string | null
          id: number
          name: string
          price: number
          product_id: number | null
          sku: string | null
          store_id: string | null
        }
        Insert: {
          average_cost?: number | null
          cost_price?: number
          created_at?: string | null
          id?: number
          name: string
          price: number
          product_id?: number | null
          sku?: string | null
          store_id?: string | null
        }
        Update: {
          average_cost?: number | null
          cost_price?: number
          created_at?: string | null
          id?: number
          name?: string
          price?: number
          product_id?: number | null
          sku?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_profit"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          store_id: string | null
          variant_id: number | null
          variant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_profit_by_date: {
        Row: {
          day: string | null
          profit: number | null
        }
        Relationships: []
      }
      v_sale_item_profit: {
        Row: {
          cashier_id: string | null
          cashier_name: string | null
          category_id: number | null
          category_name: string | null
          cost_price: number | null
          discount: number | null
          margin_pct: number | null
          product_id: number | null
          product_name: string | null
          product_snapshot: Json | null
          profit: number | null
          quantity: number | null
          receipt_number: string | null
          sale_created_at: string | null
          sale_id: string | null
          store_id: string | null
          total: number | null
          unit_price: number | null
          variant_id: number | null
          variant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      apply_inventory_change: {
        Args: {
          p_new_qty: number
          p_notes?: string
          p_type: Database["public"]["Enums"]["stock_history_type"]
          p_variant_id: number
        }
        Returns: undefined
      }
      apply_purchase_and_recalc_cost: {
        Args: {
          p_notes?: string
          p_purchase_cost: number
          p_quantity: number
          p_selling_price?: number
          p_variant_id: number
        }
        Returns: undefined
      }
      generate_member_code: { Args: never; Returns: string }
      get_cash_deposit_summary: {
        Args: { p_end?: string; p_start?: string; p_store_id: string }
        Returns: {
          today_cash: number
          total_approved_deposits: number
          total_approved_expenses: number
          total_cash_sales: number
          total_other_sales: number
          total_pending_deposits: number
        }[]
      }
      get_profit_by_cashier: {
        Args: { p_end: string; p_start: string; p_store_id: string }
        Returns: {
          cashier_id: string
          cashier_name: string
          cost: number
          margin_pct: number
          profit: number
          revenue: number
          total_transactions: number
        }[]
      }
      get_profit_by_category: {
        Args: { p_end: string; p_start: string; p_store_id: string }
        Returns: {
          category_id: number
          category_name: string
          cost: number
          margin_pct: number
          profit: number
          quantity_sold: number
          revenue: number
        }[]
      }
      get_profit_by_period: {
        Args: {
          p_end: string
          p_group_by: string
          p_start: string
          p_store_id: string
        }
        Returns: {
          cost: number
          margin_pct: number
          period_start: string
          profit: number
          revenue: number
          transactions: number
        }[]
      }
      get_profit_summary: {
        Args: { p_end: string; p_start: string; p_store_id: string }
        Returns: {
          avg_margin_pct: number
          total_cost: number
          total_profit: number
          total_revenue: number
          total_transactions: number
        }[]
      }
      get_top_products_profit: {
        Args: {
          p_end: string
          p_limit?: number
          p_metric: string
          p_start: string
          p_store_id: string
        }
        Returns: {
          cost: number
          margin_pct: number
          product_id: number
          product_name: string
          profit: number
          quantity_sold: number
          revenue: number
          variant_id: number
          variant_name: string
        }[]
      }
      get_user_store_ids: { Args: { _user_id: string }; Returns: string[] }
      has_any_store_owner_role: { Args: { _user_id: string }; Returns: boolean }
      is_developer: { Args: { _user_id: string }; Returns: boolean }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      store_has_members: { Args: { _store_id: string }; Returns: boolean }
    }
    Enums: {
      applies_to: "global" | "product" | "variant" | "category"
      discount_type: "percentage" | "fixed"
      movement_type: "in" | "out"
      stock_history_type:
        | "product_added"
        | "product_reduced"
        | "sale"
        | "stock_adjustment"
        | "stock_opname"
        | "product_return"
        | "initial_stock"
      user_role: "developer" | "staff"
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
      stock_history_type: [
        "product_added",
        "product_reduced",
        "sale",
        "stock_adjustment",
        "stock_opname",
        "product_return",
        "initial_stock",
      ],
      user_role: ["developer", "staff"],
    },
  },
} as const
