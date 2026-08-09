export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'staff'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'staff'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'staff'
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category: string | null
          barcode: string
          price: number
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          barcode: string
          price: number
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          barcode?: string
          price?: number
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          date_of_birth: string | null
          right_sphere: number | null
          right_cylinder: number | null
          right_axis: number | null
          right_add: number | null
          left_sphere: number | null
          left_cylinder: number | null
          left_axis: number | null
          left_add: number | null
          ipd: number | null
          eye_type: string | null
          lens_type: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          date_of_birth?: string | null
          right_sphere?: number | null
          right_cylinder?: number | null
          right_axis?: number | null
          right_add?: number | null
          left_sphere?: number | null
          left_cylinder?: number | null
          left_axis?: number | null
          left_add?: number | null
          ipd?: number | null
          eye_type?: string | null
          lens_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          date_of_birth?: string | null
          right_sphere?: number | null
          right_cylinder?: number | null
          right_axis?: number | null
          right_add?: number | null
          left_sphere?: number | null
          left_cylinder?: number | null
          left_axis?: number | null
          left_add?: number | null
          ipd?: number | null
          eye_type?: string | null
          lens_type?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          invoice_date: string
          customer_name: string | null
          customer_phone: string | null
          customer_address: string | null
          customer_id: string | null
          eye_type: string | null
          lens_type: string | null
          right_sphere: number | null
          right_cylinder: number | null
          right_axis: number | null
          right_add: number | null
          left_sphere: number | null
          left_cylinder: number | null
          left_axis: number | null
          left_add: number | null
          ipd: number | null
          subtotal: number
          discount: number
          total_amount: number
          amount_paid: number
          balance_due: number
          payment_status: 'paid' | 'partial' | 'unpaid'
          payment_method: 'cash' | 'card' | 'transfer' | null
          invoice_type: 'pos' | 'optical' | 'receipt'
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          invoice_date?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          customer_id?: string | null
          eye_type?: string | null
          lens_type?: string | null
          right_sphere?: number | null
          right_cylinder?: number | null
          right_axis?: number | null
          right_add?: number | null
          left_sphere?: number | null
          left_cylinder?: number | null
          left_axis?: number | null
          left_add?: number | null
          ipd?: number | null
          subtotal: number
          discount?: number
          total_amount: number
          amount_paid?: number
          balance_due?: number
          payment_status?: 'paid' | 'partial' | 'unpaid'
          payment_method?: 'cash' | 'card' | 'transfer' | null
          invoice_type?: 'pos' | 'optical' | 'receipt'
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          invoice_date?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          customer_id?: string | null
          eye_type?: string | null
          lens_type?: string | null
          right_sphere?: number | null
          right_cylinder?: number | null
          right_axis?: number | null
          right_add?: number | null
          left_sphere?: number | null
          left_cylinder?: number | null
          left_axis?: number | null
          left_add?: number | null
          ipd?: number | null
          subtotal?: number
          discount?: number
          total_amount?: number
          amount_paid?: number
          balance_due?: number
          payment_status?: 'paid' | 'partial' | 'unpaid'
          payment_method?: 'cash' | 'card' | 'transfer' | null
          invoice_type?: 'pos' | 'optical' | 'receipt'
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          shop_name: string
          ar_name: string | null
          cr_number: string | null
          shop_address: string | null
          shop_phone: string | null
          shop_vat: string | null
          shop_website: string | null
          logo_url: string | null
          receipt_header: string | null
          receipt_footer: string | null
          currency: string
          language: 'en' | 'ar'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shop_name: string
          ar_name?: string | null
          cr_number?: string | null
          shop_address?: string | null
          shop_phone?: string | null
          shop_vat?: string | null
          shop_website?: string | null
          logo_url?: string | null
          receipt_header?: string | null
          receipt_footer?: string | null
          currency?: string
          language?: 'en' | 'ar'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shop_name?: string
          ar_name?: string | null
          cr_number?: string | null
          shop_address?: string | null
          shop_phone?: string | null
          shop_vat?: string | null
          shop_website?: string | null
          logo_url?: string | null
          receipt_header?: string | null
          receipt_footer?: string | null
          currency?: string
          language?: 'en' | 'ar'
          created_at?: string
          updated_at?: string
        }
      }
      message_logs: {        Row: {
          id: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_email: string | null
          channel: 'sms' | 'email' | 'whatsapp'
          message: string
          status: 'pending' | 'sent' | 'failed'
          scheduled_for: string | null
          sent_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_email?: string | null
          channel: 'sms' | 'email' | 'whatsapp'
          message: string
          status?: 'pending' | 'sent' | 'failed'
          scheduled_for?: string | null
          sent_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_email?: string | null
          channel?: 'sms' | 'email' | 'whatsapp'
          message?: string
          status?: 'pending' | 'sent' | 'failed'
          scheduled_for?: string | null
          sent_at?: string | null
          created_by?: string
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          title: string
          category: string
          amount: number
          expense_date: string
          payment_method: 'cash' | 'card' | 'transfer' | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          category?: string
          amount: number
          expense_date?: string
          payment_method?: 'cash' | 'card' | 'transfer' | null
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          category?: string
          amount?: number
          expense_date?: string
          payment_method?: 'cash' | 'card' | 'transfer' | null
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type ShopSettings = Database['public']['Tables']['settings']['Row']
export type MessageLog = Database['public']['Tables']['message_logs']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
