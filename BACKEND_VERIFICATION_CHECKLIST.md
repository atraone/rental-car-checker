# Backend Verification Checklist

This document outlines what needs to be verified on the backend to ensure full compatibility with the updated app implementation.

## 1. User Account Creation

### ✅ Expected Behavior

When a user signs up (via email/password or OAuth), the backend should:

1. Create `auth.users` record (Supabase Auth handles this)
2. **Automatically trigger** creation of `rental_car_users` record via database trigger

### ⚠️ Verification Needed

**Question:** Is the trigger correctly set up to create `rental_car_users` record for ALL signup methods?

**Test:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname LIKE '%rental_car%';

-- Test: Sign up a new user and verify record created
SELECT * FROM rental_car_users WHERE auth_user_id = '<new_user_id>';
```

**Expected:** Every new `auth.users` record should have a corresponding `rental_car_users` record.

---

## 2. Testing User Flag

### ✅ Expected Behavior

Users with `is_testing_user = TRUE` should bypass subscription checks.

### ⚠️ Verification Needed

**Question:** Are all current users set to `is_testing_user = TRUE` as mentioned in the spec?

**Check:**
```sql
-- Check current users
SELECT 
  rcu.id,
  au.email,
  rcu.is_testing_user
FROM rental_car_users rcu
JOIN auth.users au ON au.id = rcu.auth_user_id;
```

**Action Required:**
- If not all users are testing users, set them:
```sql
UPDATE rental_car_users
SET is_testing_user = TRUE;
```

**Verify in App:**
- Sign in as a user with `is_testing_user = TRUE`
- Should have full access without subscription
- All API calls should work

---

## 3. Edge Function: rental-car-store-inspection

### ✅ Expected Request Format

```json
{
  "main_photo": "data:image/jpeg;base64,...",
  "section_photos": [
    {
      "section": "Front",
      "photoUri": "data:image/jpeg;base64,...",
      "damageNotes": "...",
      "isUsable": true,
      "needsRetake": false
    }
  ],
  "all_damage_notes": "...",
  "expected_return_date": "2026-01-15T00:00:00.000Z",
  "expected_return_date_text": "Monday, January 15, 2026",
  "after_main_photo": "data:image/jpeg;base64,...",
  "after_section_photos": [...],
  "after_created_at": "2026-01-15T12:00:00.000Z",
  "after_date_text": "...",
  "is_returned": false
}
```

### ⚠️ Verification Needed

**Questions:**

1. **Does the edge function correctly:**
   - ✅ Validate JWT?
   - ✅ Check subscription/testing status?
   - ✅ Convert Base64 to binary?
   - ✅ Upload to Storage bucket `rental-car-images`?
   - ✅ Use path structure `{user_id}/{inspection_id}/{filename}`?
   - ✅ Create `rental_car_inspections` record?
   - ✅ Create `rental_car_section_photos` records?

2. **Response Format:**
   ```json
   {
     "success": true,
     "inspection_id": "uuid"
   }
   ```
   - ✅ Does it return this exact format?
   - ✅ Does it return `inspection_id` (not `inspectionId`)?

3. **Error Handling:**
   - ✅ Does it return proper error messages?
   - ✅ Does it return `{ success: false, error: "..." }`?

**Test:**
```bash
# Test with curl
curl -X POST https://vottxjcqffropoyeqtbo.supabase.co/functions/v1/rental-car-store-inspection \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "main_photo": "data:image/jpeg;base64,/9j/4AAQ...",
    "section_photos": [],
    "all_damage_notes": "Test"
  }'
```

---

## 4. Edge Function: rental-car-get-inspections

### ✅ Expected Response Format

```json
{
  "inspections": [
    {
      "id": "uuid",
      "main_photo_url": "https://vottxjcqffropoyeqtbo.supabase.co/storage/v1/object/public/rental-car-images/user_id/inspection_id/main.jpg",
      "section_photos": [
        {
          "section": "Front",
          "photo_url": "https://...",
          "damage_notes": "...",
          "is_usable": true,
          "needs_retake": false
        }
      ],
      "all_damage_notes": "...",
      "created_at": "2026-01-09T12:00:00.000Z",
      "expected_return_date": "2026-01-15T00:00:00.000Z",
      "expected_return_date_text": "Monday, January 15, 2026",
      "after_main_photo_url": "https://...",
      "after_section_photos": [
        {
          "section": "Front",
          "photo_url": "https://..."
        }
      ],
      "after_created_at": "2026-01-15T12:00:00.000Z",
      "after_date_text": "...",
      "is_returned": false
    }
  ]
}
```

### ⚠️ Verification Needed

**Questions:**

1. **Does the edge function:**
   - ✅ Validate JWT?
   - ✅ Return all inspections for the authenticated user?
   - ✅ Include section photos in the response?
   - ✅ Return Storage URLs (not Base64)?
   - ✅ Include all fields (expected_return_date, after photos, etc.)?

2. **Field Names:**
   - ✅ Uses `main_photo_url` (not `main_photo`)?
   - ✅ Uses `photo_url` in section_photos (not `photoUri`)?
   - ✅ Uses `is_usable` (not `isUsable`)?
   - ✅ Uses `needs_retake` (not `needsRetake`)?

3. **Empty State:**
   - ✅ Returns `{ inspections: [] }` when no inspections?

**Test:**
```bash
curl -X GET https://vottxjcqffropoyeqtbo.supabase.co/functions/v1/rental-car-get-inspections \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 5. Edge Function: rental-car-manage-subscription

### ✅ Expected Request Format

```json
{
  "platform": "google_play",
  "product_id": "com.example.subscription",
  "purchase_token": "token_from_play_store",
  "expires_at": "2026-02-09T00:00:00.000Z"
}
```

### ⚠️ Verification Needed

**Questions:**

1. **Does the edge function:**
   - ✅ Validate JWT?
   - ✅ Create/update subscription record?
   - ✅ Link to correct user via `rental_car_users`?

2. **Response Format:**
   ```json
   {
     "success": true
   }
   ```
   - ✅ Does it return this format?

**Note:** Per spec, this should include server-side receipt validation in production. Current implementation may trust client (for testing).

---

## 6. API Endpoint: /api/rental-car/claude

### ✅ Expected Request Format

```json
{
  "promptText": "...",
  "imageBase64": "data:image/jpeg;base64,...",
  "imageMime": "image/jpeg"
}
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### ⚠️ Verification Needed

**Questions:**

1. **Does the endpoint:**
   - ✅ Validate JWT with Supabase?
   - ✅ Check for `rental_car_users` record?
   - ✅ Check subscription/testing status?
   - ✅ Forward to Claude API?
   - ✅ Return `{ text: "..." }` format?

2. **Error Handling:**
   - ✅ Rejects invalid JWT?
   - ✅ Rejects non-subscribed users (unless testing)?
   - ✅ Returns proper error messages?

**Test:**
```bash
curl -X POST https://atra.one/api/rental-car/claude \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "promptText": "Test",
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
    "imageMime": "image/jpeg"
  }'
```

---

## 7. API Endpoint: /api/rental-car/validate-auth

### ✅ Expected Response Format

```json
{
  "valid": true,
  "has_subscription": true,
  "is_testing_user": false
}
```

### ⚠️ Verification Needed

**Questions:**

1. **Does the endpoint:**
   - ✅ Validate JWT?
   - ✅ Check for `rental_car_users` record?
   - ✅ Check subscription status?
   - ✅ Check `is_testing_user` flag?
   - ✅ Return all three boolean flags?

**Test:**
```bash
curl -X POST https://atra.one/api/rental-car/validate-auth \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

---

## 8. Storage Configuration

### ✅ Expected Setup

- **Bucket Name:** `rental-car-images`
- **Public Access:** Yes (for displaying images)
- **Path Structure:** `{user_id}/{inspection_id}/{filename}`
- **RLS Policies:** Users can only access their own folder

### ⚠️ Verification Needed

**Questions:**

1. **Bucket Configuration:**
   - ✅ Does bucket exist?
   - ✅ Is it public?
   - ✅ Are RLS policies set correctly?

2. **File Upload:**
   - ✅ Can edge function upload files?
   - ✅ Are files organized correctly?
   - ✅ Are public URLs accessible?

3. **Security:**
   - ✅ Can users only access their own folder?
   - ✅ Can users access other users' folders? (Should be NO)

**Test:**
```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE name = 'rental-car-images';

-- Check RLS policies
SELECT * FROM storage.objects WHERE bucket_id = 'rental-car-images' LIMIT 1;
```

---

## 9. Database Schema

### ✅ Expected Tables

1. `rental_car_users`
2. `rental_car_subscriptions`
3. `rental_car_inspections`
4. `rental_car_section_photos`

### ⚠️ Verification Needed

**Check Table Existence:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'rental_car%';
```

**Check RLS Policies:**
```sql
SELECT * FROM pg_policies WHERE tablename LIKE 'rental_car%';
```

**Check Trigger:**
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%rental_car%';
```

---

## 10. Summary of Critical Checks

### Must Verify:

1. ✅ **User Creation Trigger** - Creates `rental_car_users` on signup
2. ✅ **Testing User Flag** - All current users have `is_testing_user = TRUE`
3. ✅ **Edge Function Response Formats** - Match app expectations
4. ✅ **Storage Upload** - Images upload correctly and URLs are accessible
5. ✅ **JWT Validation** - All endpoints validate JWT correctly
6. ✅ **Subscription Checking** - Works for both subscriptions and testing users

### Recommended Tests:

1. End-to-end signup flow
2. End-to-end inspection creation
3. End-to-end inspection retrieval
4. Image upload and retrieval
5. Subscription status checking

---

## 11. Common Issues & Solutions

### Issue: User signup doesn't create `rental_car_users` record

**Solution:**
- Check trigger exists and is enabled
- Verify trigger fires on `auth.users` insert

### Issue: Images not accessible

**Solution:**
- Check bucket is public
- Check RLS policies allow read access
- Verify URLs are correct format

### Issue: Edge function returns wrong format

**Solution:**
- Check edge function code matches spec
- Verify response structure matches app expectations

### Issue: Subscription check fails

**Solution:**
- Verify `is_testing_user` flag is set
- Check subscription record exists and is active
- Verify edge function checks both conditions

---

## Conclusion

Once all items above are verified, the app should work seamlessly with the backend. The app code is complete and ready for testing.

**Next Step:** Run end-to-end tests with a test user account.

