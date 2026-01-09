# API Implementation Documentation

Complete documentation of all Supabase functions and atra.one API calls used in the Rental Car Checker app.

---

## Table of Contents

1. [Supabase Functions](#supabase-functions)
   - [Authentication Functions](#authentication-functions)
   - [Database Operations](#database-operations)
   - [Edge Functions](#edge-functions)
2. [atra.one API Calls](#atraone-api-calls)
   - [Claude API](#claude-api)
   - [OpenAI API](#openai-api)
   - [Kie.ai API](#kieai-api)
3. [Data Structures](#data-structures)
4. [Error Handling](#error-handling)

---

## Supabase Functions

### Authentication Functions

All authentication functions use the Supabase client from `lib/supabase.ts`.

#### 1. `supabase.auth.getSession()`

**Purpose:** Get the current user session

**Location:** `contexts/AuthContext.tsx:65`

**Usage:**
```typescript
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
```

**Returns:**
```typescript
{
  data: {
    session: Session | null
  },
  error: AuthError | null
}
```

**When Called:**
- App initialization
- On mount of AuthProvider
- Before making authenticated API calls

**Error Handling:**
- If `sessionError` exists or `session` is null, user is not authenticated

---

#### 2. `supabase.auth.onAuthStateChange(callback)`

**Purpose:** Listen for authentication state changes (sign in, sign out, token refresh)

**Location:** `contexts/AuthContext.tsx:77`

**Usage:**
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    // Handle auth state change
    setSession(session);
    setUser(session?.user ?? null);
  }
);

// Cleanup
return () => {
  subscription.unsubscribe();
};
```

**Event Types:**
- `SIGNED_IN` - User signed in
- `SIGNED_OUT` - User signed out
- `TOKEN_REFRESHED` - Access token refreshed
- `USER_UPDATED` - User metadata updated
- `PASSWORD_RECOVERY` - Password recovery initiated

**Returns:**
```typescript
{
  data: {
    subscription: {
      unsubscribe: () => void
    }
  }
}
```

**When Called:**
- On mount of AuthProvider
- Automatically handles session persistence and refresh

---

#### 3. `supabase.auth.signInWithPassword({ email, password })`

**Purpose:** Sign in user with email and password

**Location:** `contexts/AuthContext.tsx:145`

**Usage:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string,
});
```

**Request:**
```typescript
{
  email: string,      // User's email address
  password: string   // User's password
}
```

**Response:**
```typescript
{
  data: {
    user: User | null,
    session: Session | null
  },
  error: AuthError | null
}
```

**Success Response:**
- `data.session` contains access token and user info
- `data.user` contains user metadata

**Error Cases:**
- Invalid email/password
- User not found
- Network errors

**When Called:**
- User taps "Sign In" button on auth screen
- Auto sign-in on app launch (if session exists)

---

#### 4. `supabase.auth.signUp({ email, password })`

**Purpose:** Create new user account

**Location:** `contexts/AuthContext.tsx:168`

**Usage:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string,
});
```

**Request:**
```typescript
{
  email: string,      // New user's email
  password: string   // New user's password (min 6 chars)
}
```

**Response:**
```typescript
{
  data: {
    user: User | null,
    session: Session | null
  },
  error: AuthError | null
}
```

**Success Response:**
- `data.user` contains new user object
- `data.session` may be null if email confirmation is required

**Error Cases:**
- Email already exists
- Weak password
- Invalid email format

**When Called:**
- User taps "Sign Up" button on auth screen

---

#### 5. `supabase.auth.signInWithOAuth({ provider, options })`

**Purpose:** Sign in with OAuth provider (Google, Apple)

**Location:** `contexts/AuthContext.tsx:191`

**Usage:**
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google' | 'apple',
  options: {
    redirectTo: string  // Deep link URL for OAuth callback
  }
});
```

**Request:**
```typescript
{
  provider: 'google' | 'apple',
  options: {
    redirectTo: string  // e.g., 'rental-car-checker://auth/callback'
  }
}
```

**Response:**
```typescript
{
  data: {
    url: string | null  // OAuth redirect URL
  },
  error: AuthError | null
}
```

**Flow:**
1. App calls `signInWithOAuth`
2. Supabase returns OAuth URL
3. User redirected to provider (Google/Apple)
4. User authorizes
5. Provider redirects back to app via deep link
6. `onAuthStateChange` fires with new session

**When Called:**
- User taps "Continue with Google" or "Continue with Apple"

---

#### 6. `supabase.auth.signOut()`

**Purpose:** Sign out current user

**Location:** `contexts/AuthContext.tsx:210`

**Usage:**
```typescript
await supabase.auth.signOut();
```

**Request:** None

**Response:**
```typescript
{
  error: AuthError | null
}
```

**Side Effects:**
- Clears session from storage
- Triggers `onAuthStateChange` with `SIGNED_OUT` event
- Invalidates access token

**When Called:**
- User taps "Sign Out" button
- App cleanup on logout

---

### Database Operations

#### 1. Query: `supabase.from('user_subscriptions').select('*').eq('user_id', userId).eq('is_active', true).single()`

**Purpose:** Fetch active subscription for current user

**Location:** `contexts/AuthContext.tsx:112`

**Usage:**
```typescript
const { data, error } = await supabase
  .from('user_subscriptions')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single();
```

**Request:**
- Table: `user_subscriptions`
- Filters:
  - `user_id` equals current user ID
  - `is_active` equals `true`
- `.single()` expects exactly one row

**Response:**
```typescript
{
  data: {
    id: string,
    user_id: string,
    platform: 'google_play' | 'app_store',
    subscription_id: string,
    is_active: boolean,
    expires_at: string,  // ISO timestamp
    created_at: string,
    updated_at: string
  } | null,
  error: PostgrestError | null
}
```

**Error Cases:**
- `PGRST116` - No rows found (user has no active subscription)
- Network errors
- RLS policy violation

**When Called:**
- On app launch (if user is authenticated)
- After successful sign in
- When checking subscription status

**RLS Policy Required:**
```sql
-- Users can only read their own subscription
CREATE POLICY "Users can read own subscription"
ON user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);
```

---

#### 2. Query: `supabase.from('inspections').select('*').eq('user_id', userId).order('created_at', { ascending: false })`

**Purpose:** Fetch all inspections for current user

**Location:** `services/supabase.ts:137`

**Usage:**
```typescript
const { data, error } = await supabase
  .from('inspections')
  .select('*')
  .eq('user_id', session.user.id)
  .order('created_at', { ascending: false });
```

**Request:**
- Table: `inspections`
- Filters:
  - `user_id` equals current user ID
- Order: `created_at` descending (newest first)

**Response:**
```typescript
{
  data: Array<{
    id: string,
    user_id: string,
    main_photo: string,  // Base64 data URI or URL
    section_photos: Array<{
      section: string,
      photo_uri: string,
      damage_notes: string,
      is_usable: boolean,
      needs_retake?: boolean,
      retake_reason?: string,
      is_retake?: boolean,
      is_extra?: boolean,
      serious_damage_description?: string
    }>,
    all_damage_notes: string,
    expected_return_date: string | null,  // ISO timestamp
    expected_return_date_text: string | null,
    after_main_photo: string | null,
    after_section_photos: Array<{
      section: string,
      photo_uri: string
    }> | null,
    after_created_at: string | null,  // ISO timestamp
    after_date_text: string | null,
    is_returned: boolean,
    created_at: string,  // ISO timestamp
    date_text: string,
    updated_at: string
  }> | null,
  error: PostgrestError | null
}
```

**Error Cases:**
- Network errors
- RLS policy violation
- Invalid user_id

**When Called:**
- On app launch (sync history)
- Periodic sync (every 30 seconds)
- Manual refresh

**RLS Policy Required:**
```sql
-- Users can only read their own inspections
CREATE POLICY "Users can read own inspections"
ON inspections
FOR SELECT
USING (auth.uid() = user_id);
```

---

### Edge Functions

#### 1. `POST /functions/v1/store-inspection`

**Purpose:** Store inspection results via Supabase Edge Function

**Location:** `services/supabase.ts:80`

**Base URL:**
```typescript
const SUPABASE_FUNCTIONS_URL = 
  Constants.expoConfig?.extra?.supabaseFunctionsUrl || 
  process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 
  'https://your-project.supabase.co/functions/v1';
```

**Usage:**
```typescript
const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/store-inspection`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    main_photo: string,
    section_photos: VehicleSectionPhoto[],
    all_damage_notes: string,
    expected_return_date: string | null,  // ISO timestamp
    expected_return_date_text: string | null,
    after_main_photo: string | null,
    after_section_photos: Array<{ section: string, photo_uri: string }> | null,
    after_created_at: string | null,  // ISO timestamp
    after_date_text: string | null,
    is_returned: boolean
  }),
});
```

**Request Headers:**
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <access_token>'  // From supabase.auth.getSession()
}
```

**Request Body:**
```typescript
{
  main_photo: string,  // Base64 data URI or URL
  section_photos: Array<{
    section: string,
    photo_uri: string,
    damage_notes: string,
    is_usable: boolean,
    needs_retake?: boolean,
    retake_reason?: string,
    is_retake?: boolean,
    is_extra?: boolean,
    serious_damage_description?: string
  }>,
  all_damage_notes: string,
  expected_return_date: string | null,  // ISO timestamp, e.g., "2024-12-25T00:00:00.000Z"
  expected_return_date_text: string | null,  // e.g., "Monday, December 25, 2024"
  after_main_photo: string | null,  // Base64 data URI for return inspection
  after_section_photos: Array<{
    section: string,
    photo_uri: string  // No damage notes for return photos
  }> | null,
  after_created_at: string | null,  // ISO timestamp
  after_date_text: string | null,
  is_returned: boolean  // true if return photos have been taken
}
```

**Response (Success):**
```typescript
{
  inspection_id: string,  // UUID of stored inspection
  success?: boolean
}
```

**Response (Error):**
```typescript
{
  error: string,  // Error message
  success?: false
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (invalid data)
- `401` - Unauthorized (invalid/missing token)
- `500` - Server error

**When Called:**
- After user saves inspection results
- When updating inspection with return photos
- Automatically on save (non-blocking)

**Edge Function Implementation (Deno):**
```typescript
// supabase/functions/store-inspection/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
      });
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    // Parse request body
    const body = await req.json();

    // Insert inspection
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        user_id: user.id,
        main_photo: body.main_photo,
        section_photos: body.section_photos,
        all_damage_notes: body.all_damage_notes,
        expected_return_date: body.expected_return_date,
        expected_return_date_text: body.expected_return_date_text,
        after_main_photo: body.after_main_photo,
        after_section_photos: body.after_section_photos,
        after_created_at: body.after_created_at,
        after_date_text: body.after_date_text,
        is_returned: body.is_returned || false,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({ inspection_id: data.id, success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

---

## atra.one API Calls

All API calls to `atra.one` are proxied through the backend to protect API keys. The base URL is determined by `lib/apiBaseUrl.ts`, which **always** returns `https://atra.one` (unless explicitly overridden).

### Base URL Configuration

**Location:** `lib/apiBaseUrl.ts`

**Function:**
```typescript
export function getApiBaseUrl(): string {
  // Explicit override (for local testing only)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // ALWAYS use atra.one for both dev and production
  return 'https://atra.one';
}
```

**Priority:**
1. `EXPO_PUBLIC_API_BASE_URL` environment variable (if set)
2. Default: `https://atra.one` (always)

---

### Claude API

#### `POST /api/claude`

**Purpose:** Analyze vehicle photos using Claude AI (text + vision)

**Location:** `services/claude.ts:18`

**Usage:**
```typescript
import { analyzeWithClaude } from '@/services/claude';

const result = await analyzeWithClaude({
  promptText: string,
  imageBase64: string,
  imageMime: string,
});
```

**Request URL:**
```
https://atra.one/api/claude
```

**Request Headers:**
```typescript
{
  'Content-Type': 'application/json'
}
```

**Request Body:**
```typescript
{
  promptText: string,    // Analysis prompt/instructions
  imageBase64: string,   // Base64-encoded image (no data URI prefix)
  imageMime: string      // 'image/jpeg' | 'image/png'
}
```

**Example Request:**
```typescript
{
  promptText: "You are a vehicle inspection assistant. Analyze this photo...",
  imageBase64: "/9j/4AAQSkZJRgABAQAAAQ...",  // Base64 string
  imageMime: "image/jpeg"
}
```

**Response (Success):**
```typescript
{
  text: string  // Claude's analysis response (JSON or plain text)
}
```

**Response (Error):**
```typescript
{
  error: string  // Error message
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request
- `500` - Server error

**When Called:**
1. **Initial Vehicle Photo Analysis** (`app/capture-initial.tsx`)
   - Detects if photo shows a vehicle
   - Identifies sections to document
   - Returns JSON: `{ isVehicle: boolean, sections: string[] }`

2. **Section Photo Analysis** (`app/capture-section.tsx`)
   - Analyzes damage in each section
   - Validates photo usability
   - Returns JSON with damage notes and retake reasons

3. **Return Photo Analysis** (`app/capture-after-initial.tsx`)
   - Same as initial, but for return inspection
   - No damage analysis needed

4. **Counter Claim Generation** (`app/counter-claim.tsx`)
   - Analyzes rental company claim documents
   - Generates dispute letter
   - Returns formatted text for PDF

**Backend Implementation:**
The backend at `atra.one` proxies this request to Anthropic's Claude API:
```typescript
// Backend receives request
POST https://atra.one/api/claude
{
  promptText: "...",
  imageBase64: "...",
  imageMime: "image/jpeg"
}

// Backend forwards to Anthropic
POST https://api.anthropic.com/v1/messages
Headers: {
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json'
}
Body: {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: promptText },
      { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } }
    ]
  }]
}

// Backend returns response
{
  text: "<Claude's response>"
}
```

---

### OpenAI API

#### `POST /api/openai`

**Purpose:** Generate or edit images using OpenAI DALL-E

**Location:** `services/openai.ts:19`

**Usage:**
```typescript
import { generateImageWithOpenAI } from '@/services/openai';

const imageDataUri = await generateImageWithOpenAI({
  prompt: string,
  imageBase64: string,
  imageMime: string,
  aspectRatio?: '1:1' | '16:9' | '9:16',
});
```

**Request URL:**
```
https://atra.one/api/openai
```

**Request Headers:**
```typescript
{
  'Content-Type': 'application/json'
}
```

**Request Body:**
```typescript
{
  prompt: string,        // Image generation/editing prompt
  imageBase64: string,   // Base64-encoded image (for editing)
  imageMime: string,     // 'image/jpeg' | 'image/png'
  aspectRatio?: string   // '1:1' | '16:9' | '9:16' (optional)
}
```

**Response (Success):**
```typescript
{
  image: string  // Data URI: "data:image/png;base64,..."
}
```

**Response (Error):**
```typescript
{
  error: string
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request
- `500` - Server error

**When Called:**
- Currently **not used** in the rental car checker app
- Available for future image generation features

**Backend Implementation:**
The backend proxies to OpenAI's DALL-E API:
```typescript
// Backend forwards to OpenAI
POST https://api.openai.com/v1/images/generations
Headers: {
  'Authorization': `Bearer ${OPENAI_API_KEY}`,
  'Content-Type': 'application/json'
}
Body: {
  model: 'dall-e-3',
  prompt: prompt,
  n: 1,
  size: '1024x1024',
  response_format: 'b64_json'
}

// Backend returns
{
  image: `data:image/png;base64,${base64Image}`
}
```

---

### Kie.ai API

#### `POST /api/kie`

**Purpose:** Edit images using Kie.ai's nano banana model

**Location:** `services/kie.ts:19`

**Usage:**
```typescript
import { generateImageWithKie } from '@/services/kie';

const imageDataUri = await generateImageWithKie({
  prompt: string,
  imageBase64: string,
  imageMime: string,
});
```

**Request URL:**
```
https://atra.one/api/kie
```

**Request Headers:**
```typescript
{
  'Content-Type': 'application/json'
}
```

**Request Body:**
```typescript
{
  prompt: string,        // Image editing instruction
  imageBase64: string,   // Base64-encoded image
  imageMime: string      // 'image/jpeg' | 'image/png'
}
```

**Response (Success):**
```typescript
{
  image: string  // Data URI: "data:image/png;base64,..."
}
```

**Response (Error):**
```typescript
{
  error: string
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request
- `500` - Server error

**When Called:**
- Currently **not used** in the rental car checker app
- Available for future image editing features

**Backend Implementation:**
The backend uses Kie.ai's API with polling:
```typescript
// Step 1: Upload image
POST https://kieai.redpandaai.co/api/file-base64-upload
Headers: {
  'Authorization': `Bearer ${KIE_API_KEY}`,
  'Content-Type': 'application/json'
}
Body: {
  file: imageBase64,
  mimeType: imageMime
}
Response: { fileId: string }

// Step 2: Create task
POST https://api.kie.ai/api/v1/jobs/createTask
Headers: {
  'Authorization': `Bearer ${KIE_API_KEY}`,
  'Content-Type': 'application/json'
}
Body: {
  model: 'nano-banana',
  prompt: prompt,
  fileId: fileId
}
Response: { taskId: string }

// Step 3: Poll for result
GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}
Headers: {
  'Authorization': `Bearer ${KIE_API_KEY}`
}
Response: {
  status: 'completed' | 'processing',
  result?: { image: base64String }
}

// Backend returns when complete
{
  image: `data:image/png;base64,${base64Image}`
}
```

---

## Data Structures

### VehicleSectionPhoto

**Location:** `contexts/HistoryContext.tsx:8`

```typescript
interface VehicleSectionPhoto {
  section: string;                    // e.g., "Front", "Driver Side"
  photoUri: string;                   // Data URI or file path
  damageNotes: string;                // AI-generated or user-entered notes
  isUsable: boolean;                  // Photo quality check
  needsRetake?: boolean;              // Whether photo needs retake
  retakeReason?: string;              // Why retake is needed (5-7 words)
  isRetake?: boolean;                 // Is this a retake photo
  isExtra?: boolean;                  // Is this an extra photo for serious damage
  seriousDamageDescription?: string;  // Description of serious damage
}
```

### AfterSectionPhoto

**Location:** `contexts/HistoryContext.tsx:15`

```typescript
interface AfterSectionPhoto {
  section: string;     // Section name
  photoUri: string;    // Data URI or file path
  // No damage notes for return photos
}
```

### HistoryItem

**Location:** `contexts/HistoryContext.tsx:17`

```typescript
interface HistoryItem {
  id: string;                          // Unique inspection ID
  mainPhoto: string;                   // Initial vehicle photo (before)
  sectionPhotos: VehicleSectionPhoto[]; // Section photos with damage notes
  allDamageNotes: string;              // Combined damage notes text
  createdAt: number;                   // Timestamp (milliseconds)
  dateText: string;                    // Formatted date string
  expectedReturnDate?: number;          // Expected return date timestamp
  expectedReturnDateText?: string;      // Formatted return date
  afterMainPhoto?: string;             // Return vehicle photo
  afterSectionPhotos?: AfterSectionPhoto[]; // Return section photos
  afterCreatedAt?: number;             // Return photo timestamp
  afterDateText?: string;              // Formatted return date
  isReturned?: boolean;                // Has return photos been taken
}
```

---

## Error Handling

### Supabase Errors

**Common Error Codes:**
- `PGRST116` - No rows returned (expected for `.single()` when no match)
- `23505` - Unique constraint violation
- `23503` - Foreign key violation
- `42501` - RLS policy violation

**Error Handling Pattern:**
```typescript
const { data, error } = await supabase.from('table').select('*');

if (error) {
  if (error.code === 'PGRST116') {
    // No rows found - handle gracefully
    return [];
  }
  console.error('Supabase error:', error);
  throw error;
}

return data;
```

### atra.one API Errors

**Error Handling Pattern:**
```typescript
try {
  const response = await fetch(`${baseUrl}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
} catch (error) {
  console.error('API error:', error);
  throw error;
}
```

---

## Summary

### Supabase Functions Used

1. **Authentication:**
   - `getSession()` - Get current session
   - `onAuthStateChange()` - Listen for auth changes
   - `signInWithPassword()` - Email/password sign in
   - `signUp()` - Create account
   - `signInWithOAuth()` - Social sign in
   - `signOut()` - Sign out

2. **Database:**
   - `from('user_subscriptions').select()` - Get subscription status
   - `from('inspections').select()` - Get user inspections

3. **Edge Functions:**
   - `POST /functions/v1/store-inspection` - Store inspection data

### atra.one API Endpoints

1. **POST /api/claude** - Vehicle photo analysis
2. **POST /api/openai** - Image generation (not currently used)
3. **POST /api/kie** - Image editing (not currently used)

All API calls are routed through `https://atra.one` to protect API keys. The backend at `atra.one` proxies requests to external services (Anthropic, OpenAI, Kie.ai) and returns responses to the app.


