/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for authentication and data storage.
 * 
 * IMPORTANT: Replace these placeholder values with your actual Supabase project credentials:
 * - SUPABASE_URL: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
 * - SUPABASE_ANON_KEY: Your Supabase anonymous/public key
 * 
 * These should be set as environment variables:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 
                    process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    'https://your-project.supabase.co';

const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 
                        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        'your-anon-key-here';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Supabase Database Schema Documentation
 * 
 * Required Tables:
 * 
 * 1. inspections (stores complete inspection results)
 *    - id: uuid (primary key, default: uuid_generate_v4())
 *    - user_id: uuid (foreign key to auth.users)
 *    - main_photo: text (base64 data URI or URL)
 *    - section_photos: jsonb (array of VehicleSectionPhoto objects)
 *    - all_damage_notes: text
 *    - created_at: timestamp (default: now())
 *    - updated_at: timestamp (default: now())
 * 
 * 2. user_subscriptions (tracks subscription status)
 *    - id: uuid (primary key)
 *    - user_id: uuid (foreign key to auth.users, unique)
 *    - platform: text ('google_play' | 'app_store')
 *    - subscription_id: text (platform-specific subscription ID)
 *    - is_active: boolean
 *    - expires_at: timestamp
 *    - created_at: timestamp
 *    - updated_at: timestamp
 * 
 * Required RLS (Row Level Security) Policies:
 * - Users can only read/write their own inspections
 * - Users can only read/write their own subscription data
 * 
 * Required Edge Function:
 * - store-inspection (POST /store-inspection)
 *   - Validates user session
 *   - Stores inspection data
 *   - Returns stored inspection ID
 */

