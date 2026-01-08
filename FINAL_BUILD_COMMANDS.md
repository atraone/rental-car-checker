# 🚀 Final Production Build Commands

## Complete Build Sequence

### Part A: Bundle React/JavaScript Code to Android

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app
npx expo prebuild --platform android --clean
```

**What this does:**
- Bundles React/JS code into Android project
- Includes new icon from `app.json`
- Generates native Android project files

---

### Part B: Build Native Android App (Production)

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
./gradlew clean
./gradlew assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

---

### Part C: Production Build for Google Play Store (Signed AAB)

#### Step 1: Generate Production Keystore (if not exists)

```bash
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
```

#### Step 2: Create keystore.properties

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
cat > keystore.properties << 'EOF'
storePassword=makeupcheck2024
keyPassword=makeupcheck2024
keyAlias=makeup-check-key
storeFile=release.keystore
EOF
```

#### Step 3: Update build.gradle

Edit `android/app/build.gradle`:

**Add after line 69 (after `enableMinifyInReleaseBuilds`):**
```gradle
// Load keystore properties for release signing
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

**Update `signingConfigs` section (around line 100):**
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

**Update `release` buildType (around line 112):**
```gradle
release {
    // Production signing with release keystore
    if (keystorePropertiesFile.exists()) {
        signingConfig signingConfigs.release
    } else {
        // Fallback to debug for testing (NOT for Play Store)
        signingConfig signingConfigs.debug
    }
    def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
    shrinkResources enableShrinkResources.toBoolean()
    minifyEnabled enableMinifyInReleaseBuilds
    proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
    crunchPngs enablePngCrunchInRelease.toBoolean()
}
```

#### Step 4: Build Production AAB

```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app/android
./gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

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

# 1. Generate keystore (if needed - only once)
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

# 2. Create keystore.properties (if needed - only once)
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

## Install & Test on Phone

```bash
# Install production APK
cd /home/verycosmic/ReactNatives/rork-makeup-check-app
adb -s 192.168.1.184:44193 install -r android/app/build/outputs/apk/release/app-release.apk

# Launch app
adb -s 192.168.1.184:44193 shell am start -n app.rork.makeup_check_app/app.rork.makeup_check_app.MainActivity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
```

---

## Notes

- **AAB vs APK:** Google Play Store prefers AAB format
- **Keystore Backup:** ⚠️ **CRITICAL** - Back up `android/app/release.keystore` and `android/keystore.properties` securely
- **Icon:** New vanity mirror icon with equal deadspace is now integrated

