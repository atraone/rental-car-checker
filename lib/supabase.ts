/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for authentication ONLY.
 * 
 * IMPORTANT: The app does NOT use direct database access. All database operations
 * go through authenticated edge functions. The Supabase client is only used for:
 * - Authentication (sign up, sign in, OAuth)
 * - Session management
 * - Getting JWT tokens for edge function calls
 * 
 * NO DIRECT DATABASE QUERIES are performed from the client.
 * 
 * Environment variables:
 * - EXPO_PUBLIC_SUPABASE_URL (optional, defaults to project URL)
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY (required for auth only)
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase Configuration (per Authentication Integration Guide)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 
                    process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    'https://vottxjcqffropoyeqtbo.supabase.co';

// Anon key from Authentication Integration Guide
// This key is safe to use client-side - it only enables Supabase Auth
// All database access goes through edge functions with JWT, so anon key doesn't grant DB access
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 
                        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdHR4amNxZmZyb3BveWVxdGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNzg0NzcsImV4cCI6MjA4MjY1NDQ3N30.-zd92ieg59Tgmqlgu9uxR6G9yhLj429JG2nN3yEP5kw';

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
 * Database: Supabase (Project ID: vottxjcqffropoyeqtbo)
 * 
 * Required Tables (in public schema):
 * 
 * 1. rental_car_users
 *    - id: uuid (primary key)
 *    - auth_user_id: uuid (foreign key to auth.users, unique)
 *    - is_testing_user: boolean (default: false)
 *    - created_at: timestamp
 *    - updated_at: timestamp
 * 
 * 2. rental_car_subscriptions
 *    - id: uuid (primary key)
 *    - user_id: uuid (foreign key to rental_car_users.id)
 *    - platform: text ('google_play' | 'app_store')
 *    - product_id: text
 *    - purchase_token: text
 *    - is_active: boolean
 *    - expires_at: timestamp
 *    - created_at: timestamp
 *    - updated_at: timestamp
 * 
 * 3. rental_car_inspections
 *    - id: uuid (primary key)
 *    - user_id: uuid (foreign key to rental_car_users.id)
 *    - main_photo_url: text (URL from Supabase Storage)
 *    - all_damage_notes: text
 *    - expected_return_date: timestamp (nullable)
 *    - expected_return_date_text: text (nullable)
 *    - after_main_photo_url: text (nullable, URL from Storage)
 *    - after_created_at: timestamp (nullable)
 *    - after_date_text: text (nullable)
 *    - is_returned: boolean (default: false)
 *    - created_at: timestamp
 *    - updated_at: timestamp
 * 
 * 4. rental_car_section_photos
 *    - id: uuid (primary key)
 *    - inspection_id: uuid (foreign key to rental_car_inspections.id)
 *    - section: text
 *    - photo_url: text (URL from Supabase Storage)
 *    - damage_notes: text
 *    - is_usable: boolean
 *    - needs_retake: boolean
 *    - created_at: timestamp
 * 
 * Storage:
 * - Bucket: rental-car-images (public access)
 * - Path structure: {user_id}/{inspection_id}/{filename}
 * - RLS policies ensure users can only access their own folder
 * 
 * Required RLS (Row Level Security) Policies:
 * - Users can only read/write their own data
 * - Storage objects are scoped by user_id folder
 * 
 * Required Edge Functions:
 * - rental-car-store-inspection (POST /functions/v1/rental-car-store-inspection)
 *   - Validates JWT and subscription/testing status
 *   - Converts Base64 images to Storage
 *   - Creates inspection and section photo records
 * 
 * - rental-car-get-inspections (GET /functions/v1/rental-car-get-inspections)
 *   - Validates JWT
 *   - Returns all user inspections with section photos
 * 
 * - rental-car-manage-subscription (POST /functions/v1/rental-car-manage-subscription)
 *   - Validates JWT
 *   - Creates/updates subscription record
 * 
 * User Creation Trigger:
 * - Automatically creates rental_car_users record when auth.users record is created
 */


