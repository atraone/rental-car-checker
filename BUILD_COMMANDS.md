# 🛠️ Build Commands for Android Production

## Part A: Bundle React/JavaScript Code to Android

First, compile/bundle the React codebase into the Android native project:

```bash
# Navigate to project root
cd /home/verycosmic/ReactNatives/rork-makeup-check-app

# Ensure native Android project is up to date with app.json (includes new icon)
npx expo prebuild --platform android --clean

# This bundles React/JS code and generates native Android project
# The icon from app.json will be included in the native resources
```

**What this does:**
- Reads `app.json` configuration (including new icon)
- Bundles React/JavaScript code
- Generates/updates native Android project files
- Includes icon assets in Android resources

## Part B: Build Native Android App (Production)

Now compile the native Android app to production:

```bash
# Navigate to android directory
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android

# Clean previous builds (optional but recommended)
./gradlew clean

# Build release APK (production build with bundled React code and new icon)
./gradlew assembleRelease
```

**Output location:**
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## Part C: Production Build for Google Play Store (Signed AAB)

### Step 1: Generate Production Keystore (if not exists)

**Note:** Do this AFTER Part A and Part B are complete, or do it once and reuse for all builds.

```bash
# Navigate to android/app directory
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android/app

# Generate production keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore release.keystore \
  -alias makeup-check-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass makeupcheck2024 \
  -keypass makeupcheck2024 \
  -dname "CN=Makeup Check App, OU=Development, O=Rork, L=Unknown, ST=Unknown, C=US"
```

**⚠️ IMPORTANT:** Save these credentials securely:
- Store Password: `makeupcheck2024`
- Key Password: `makeupcheck2024`
- Key Alias: `makeup-check-key`

### Step 2: Create keystore.properties

```bash
# Navigate to android directory
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android

# Create keystore.properties file
cat > keystore.properties << 'EOF'
storePassword=makeupcheck2024
keyPassword=makeupcheck2024
keyAlias=makeup-check-key
storeFile=release.keystore
EOF
```

### Step 3: Update build.gradle for Release Signing

Add this to `android/app/build.gradle`:

**Find this section (around line 69):**
```gradle
def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
```

**Add after it:**
```gradle
// Load keystore properties for release signing
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

**Find the `signingConfigs` section (around line 100):**
```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
}
```

**Replace with:**
```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
```

**Find the `release` buildType (around line 112):**
```gradle
release {
    // Caution! In production, you need to generate your own keystore file.
    // see https://reactnative.dev/docs/signed-apk-android.
    signingConfig signingConfigs.debug
```

**Replace with:**
```gradle
release {
    // Production signing with release keystore
    if (keystorePropertiesFile.exists()) {
        signingConfig signingConfigs.release
    } else {
        // Fallback to debug for testing (NOT for Play Store)
        signingConfig signingConfigs.debug
    }
```

### Step 4: Build Production AAB

```bash
# Navigate to android directory
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android

# Build production Android App Bundle (AAB)
./gradlew bundleRelease

# Or build signed APK (alternative)
./gradlew assembleRelease
```

**Output locations:**
- **AAB (for Play Store):** `android/app/build/outputs/bundle/release/app-release.aab`
- **APK (alternative):** `android/app/build/outputs/apk/release/app-release.apk`

---

## Quick Reference: All Commands in Sequence

```bash
# ============================================
# PART A: Bundle React/JS Code to Android
# ============================================
cd /home/verycosmic/ReactNatives/rork-makeup-check-app
npx expo prebuild --platform android --clean

# ============================================
# PART B: Build Native Android App (Production)
# ============================================
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
./gradlew clean
./gradlew assembleRelease

# ============================================
# PART C: Production Build Setup (Signed AAB for Play Store)
# ============================================

# 1. Generate keystore (if needed)
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore release.keystore \
  -alias makeup-check-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass makeupcheck2024 \
  -keypass makeupcheck2024 \
  -dname "CN=Makeup Check App, OU=Development, O=Rork, L=Unknown, ST=Unknown, C=US"

# 2. Create keystore.properties
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
cat > keystore.properties << 'EOF'
storePassword=makeupcheck2024
keyPassword=makeupcheck2024
keyAlias=makeup-check-key
storeFile=release.keystore
EOF

# 3. Update build.gradle (manual edit required - see Step 3 above)

# 4. Build production AAB
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
./gradlew bundleRelease
```

---

## Verification

After building, verify the AAB is signed:

```bash
# Check AAB signature
cd /home/verycosmic/ReactNatives/rork-makeup-check-app
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Or check file exists and size:

```bash
ls -lh android/app/build/outputs/bundle/release/app-release.aab
```

---

## Notes

- **AAB vs APK:** Google Play Store prefers AAB format (smaller downloads, optimized delivery)
- **Keystore Backup:** ⚠️ **CRITICAL** - Back up `android/app/release.keystore` and `android/keystore.properties` securely. You cannot update your app without them!
- **First Build:** The first production build may take 5-10 minutes
- **Icon:** The new vanity mirror icon will be included automatically from `app.json` configuration

