# 🚀 Google Play Store Submission Checklist

## ✅ What's Already Ready

- ✅ **App compiles and runs** - Release APK built successfully
- ✅ **API endpoints configured** - Uses `https://atra.one` in production
- ✅ **Standalone app** - No Metro bundler required
- ✅ **Permissions declared** - Camera, storage, internet properly configured
- ✅ **App metadata** - Name, version, package ID set in `app.json`

## ⚠️ What Needs to Be Done

### 1. **Production Keystore** (CRITICAL - Required for Play Store)

**Current Status:** Using debug signing (NOT allowed for Play Store)

**Action Required:**
- Generate a production keystore (see below)
- Configure `build.gradle` to use it
- **BACKUP THE KEYSTORE** - You cannot update the app without it!

### 2. **Build Android App Bundle (AAB)** (Recommended)

**Current Status:** Built APK (works, but AAB is preferred)

**Why AAB?**
- Smaller download sizes for users
- Google Play optimizes delivery
- Required for Play App Signing

**Action:** Build AAB instead of APK

### 3. **App Store Listing** (Required)

You'll need to prepare:
- **App name** (max 50 chars): "Makeup Check App"
- **Short description** (max 80 chars)
- **Full description** (max 4000 chars)
- **Screenshots** (at least 2, up to 8)
  - Phone: 16:9 or 9:16 aspect ratio
  - Minimum: 320px, Maximum: 3840px
- **Feature graphic** (1024 x 500px)
- **App icon** (512 x 512px) - Already have in `assets/images/icon.png`
- **Privacy policy URL** (required if app collects data)
- **Content rating** (complete questionnaire)

### 4. **Privacy Policy** (Required)

Since your app:
- Uses camera (takes photos)
- Sends images to AI services (Claude, Kie.ai)
- Stores history locally

**You need:**
- A privacy policy URL explaining:
  - What data is collected (photos)
  - How it's used (AI analysis)
  - Where it's sent (Claude, Kie.ai APIs)
  - How it's stored (local device only)
  - Data retention policy

### 5. **Testing** (Recommended)

- ✅ Tested on physical device - **DONE!**
- Test on different Android versions if possible
- Test camera functionality
- Test API connectivity
- Test history storage

### 6. **Version Management**

**Current:** `1.0.0` (in `app.json`)

**For updates:**
- Increment version code in `build.gradle`
- Increment version name in `app.json`
- Use same keystore for all updates

---

## 🔧 Setup Instructions

### Step 1: Generate Production Keystore

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android/app

keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore \
  -alias makeup-check-key -keyalg RSA -keysize 2048 -validity 10000

# You'll be prompted for:
# - Password (SAVE THIS!)
# - Name, Organization, etc.
# - Confirm with 'yes'
```

**⚠️ CRITICAL:** Save the keystore password and alias password securely!

### Step 2: Configure build.gradle

The keystore configuration will be added to `android/app/build.gradle`:
- Release signing config pointing to `release.keystore`
- Keystore password stored in `android/keystore.properties` (gitignored)

### Step 3: Build AAB

```bash
cd android
./gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

### Step 4: Upload to Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app (or select existing)
3. Upload AAB file
4. Complete store listing
5. Submit for review

---

## 📋 Pre-Submission Checklist

- [ ] Production keystore generated and backed up
- [ ] `build.gradle` configured with release signing
- [ ] AAB built successfully
- [ ] App tested on physical device
- [ ] Privacy policy URL created and accessible
- [ ] Store listing content prepared (screenshots, descriptions)
- [ ] Content rating questionnaire completed
- [ ] App version and package name finalized
- [ ] API endpoints confirmed working (`https://atra.one`)

---

## 🎯 Quick Start: Build Production AAB Now

After keystore is set up:

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
./gradlew bundleRelease
```

**AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`

**Upload this file to Google Play Console!**

---

## 📚 Resources

- [Google Play Console](https://play.google.com/console)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [AAB Format Guide](https://developer.android.com/guide/app-bundle)
- [Privacy Policy Requirements](https://support.google.com/googleplay/android-developer/answer/10787469)

