/**
 * supabase
 * ----------------
 * TODO: Add description and exports for supabase.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Server-side admin client (bypasses RLS). NEVER expose the key to the client.
const serverUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const serverSupabase = serviceRoleKey && serverUrl
  ? createClient<Database>(serverUrl, serviceRoleKey)
  : supabase

// Check if Supabase is properly configured with valid environment variables
export const isSupabaseConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined && 
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key'

export const isSupabaseAdminConfigured = !!(serviceRoleKey && serverUrl)

// Re-export types from the generated file
export type { Database, Json } from '@/types/supabase' 
