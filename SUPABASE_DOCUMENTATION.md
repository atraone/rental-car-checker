# Supabase Integration Documentation

This document describes the Supabase integration for the Rental Car Checker app, including database schema, edge functions, API formats, and sync logic.

## Table of Contents

1. [Setup](#setup)
2. [Database Schema](#database-schema)
3. [Edge Functions](#edge-functions)
4. [API Formats](#api-formats)
5. [Authentication](#authentication)
6. [History Sync](#history-sync)
7. [Subscription Management](#subscription-management)

## Setup

### Environment Variables

Add these to your `.env` file or `app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://your-project.supabase.co",
      "supabaseAnonKey": "your-anon-key-here",
      "supabaseFunctionsUrl": "https://your-project.supabase.co/functions/v1"
    }
  }
}
```

Or use environment variables:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL`

## Database Schema

### Table: `inspections`

Stores complete inspection results for each user.

```sql
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  main_photo TEXT NOT NULL,
  section_photos JSONB NOT NULL,
  all_damage_notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_inspections_user_id ON inspections(user_id);
CREATE INDEX idx_inspections_created_at ON inspections(created_at DESC);

-- RLS Policies
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inspections"
  ON inspections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inspections"
  ON inspections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inspections"
  ON inspections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inspections"
  ON inspections FOR DELETE
  USING (auth.uid() = user_id);
```

### Table: `user_subscriptions`

Tracks subscription status for each user.

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('google_play', 'app_store')),
  subscription_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_is_active ON user_subscriptions(is_active);

-- RLS Policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Edge Functions

### Function: `store-inspection`

**Endpoint:** `POST /functions/v1/store-inspection`

**Purpose:** Store a complete inspection result with validation.

**Authentication:** Requires valid Supabase session token in `Authorization` header.

**Request Format:**
```json
{
  "main_photo": "data:image/jpeg;base64,...",
  "section_photos": [
    {
      "section": "Front",
      "photo_uri": "data:image/jpeg;base64,...",
      "damage_notes": "Minor scratch on front bumper",
      "is_usable": true,
      "needs_retake": false
    }
  ],
  "all_damage_notes": "Front: Minor scratch on front bumper\n\nBack: No visible damage"
}
```

**Response Format (Success):**
```json
{
  "success": true,
  "inspection_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Format (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Edge Function Implementation (Deno):**

```typescript
// supabase/functions/store-inspection/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { main_photo, section_photos, all_damage_notes } = await req.json();

    // Validate required fields
    if (!main_photo || !section_photos || !all_damage_notes) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert inspection
    const { data, error } = await supabaseClient
      .from('inspections')
      .insert({
        user_id: user.id,
        main_photo: main_photo,
        section_photos: section_photos,
        all_damage_notes: all_damage_notes,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting inspection:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inspection_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## API Formats

### VehicleSectionPhoto Format

```typescript
interface VehicleSectionPhoto {
  section: string;           // e.g., "Front", "Driver Side"
  photo_uri: string;         // Data URI or URL
  damage_notes: string;      // Analysis text
  is_usable: boolean;        // Whether photo is usable
  needs_retake?: boolean;    // Whether photo needs retake
}
```

### HistoryItem Format (Local)

```typescript
interface HistoryItem {
  id: string;                // UUID
  mainPhoto: string;         // Data URI
  sectionPhotos: VehicleSectionPhoto[];
  allDamageNotes: string;    // Combined notes
  createdAt: number;         // Unix timestamp
  dateText: string;          // Formatted date string
}
```

### Inspection Format (Supabase)

```typescript
interface Inspection {
  id: string;                // UUID
  user_id: string;           // UUID (foreign key)
  main_photo: string;        // Data URI
  section_photos: VehicleSectionPhoto[];  // JSONB
  all_damage_notes: string;
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
}
```

## Authentication

### Sign Up

**Endpoint:** `POST /auth/v1/signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": { ... },
  "session": { ... }
}
```

### Sign In

**Endpoint:** `POST /auth/v1/token?grant_type=password`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### OAuth (Google/Apple)

**Endpoint:** `GET /auth/v1/authorize?provider=google`

Redirects to OAuth provider, then back to app via deep link.

### Session Management

Sessions are automatically persisted using AsyncStorage and refreshed automatically.

## History Sync

### Sync Logic

1. **On App Launch:**
   - Load local history from AsyncStorage
   - Fetch all inspections from Supabase
   - Merge: Supabase takes precedence for conflicts
   - Save merged history locally

2. **After Saving Inspection:**
   - Save to local history immediately
   - Save to Supabase asynchronously (non-blocking)
   - If Supabase save fails, local save still succeeds

3. **Periodic Sync:**
   - Every 30 seconds, sync local with Supabase
   - Only update if differences detected

### Conflict Resolution

- **Same ID exists in both:** Supabase version takes precedence
- **Local-only items:** Added to merged list
- **Supabase-only items:** Added to merged list
- **Sorting:** By `created_at` descending (newest first)

## Subscription Management

### Check Subscription Status

Queries `user_subscriptions` table for active subscription:

```typescript
const { data } = await supabase
  .from('user_subscriptions')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single();
```

### Platform Integration

**Google Play (Android):**
- Use Google Play Billing Library
- Verify subscription server-side
- Update `user_subscriptions` table

**App Store (iOS):**
- Use StoreKit 2
- Verify receipt server-side
- Update `user_subscriptions` table

### Debug Bypass

In debug builds (`__DEV__ === true`), a bypass button is available to skip authentication and subscription checks. This is stored in AsyncStorage and persists across app restarts.

## Error Handling

All Supabase operations include error handling:

- **Network errors:** Logged, local operations continue
- **Authentication errors:** Redirect to auth screen
- **Validation errors:** Shown to user via Alert
- **Sync errors:** Logged, local history preserved

## Security Considerations

1. **Row Level Security (RLS):** All tables have RLS enabled
2. **Session Validation:** Edge functions validate user sessions
3. **Data Validation:** Input validation on both client and server
4. **Secure Storage:** Sensitive data stored in AsyncStorage (encrypted on device)

## Testing

To test the integration:

1. Set up Supabase project
2. Run SQL migrations to create tables
3. Deploy edge function
4. Configure environment variables
5. Test authentication flow
6. Test inspection storage
7. Test history sync

## Troubleshooting

**Common Issues:**

1. **"User not authenticated"**
   - Check session is valid
   - Verify token in Authorization header

2. **"Missing required fields"**
   - Verify all fields in request body
   - Check data types match schema

3. **Sync not working**
   - Check network connectivity
   - Verify Supabase URL and keys
   - Check RLS policies

4. **Subscription not recognized**
   - Verify subscription record exists
   - Check `is_active` and `expires_at` fields
   - Ensure user_id matches authenticated user


