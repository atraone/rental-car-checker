# 📱 Android Studio Setup Guide

## ✅ Android Project Generated

The native Android project has been successfully generated at:
```
/home/verycosmic/ReactNatives/rork-makeup-check-app/android/
```

---

## 🚀 Opening in Android Studio

### Step 1: Open Android Studio
1. Launch Android Studio
2. Click **"Open"** (or **File > Open**)

### Step 2: Select Project Directory
Navigate to and select:
```
/home/verycosmic/ReactNatives/rork-makeup-check-app/android/
```

Click **"OK"**

### Step 3: Wait for Gradle Sync
- Android Studio will automatically sync Gradle
- First time may take **5-10 minutes** (downloads dependencies)
- Watch the progress bar at the bottom

---

## 📲 Running on Device

### Prerequisites:
1. **Enable USB Debugging** on your Android device:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

2. **Connect Device via USB**
   - Connect phone to computer
   - Accept "Allow USB Debugging" prompt on device

### Run the App:
1. In Android Studio, select your device from the **device dropdown** (top toolbar)
2. Click the green **"Run"** button (▶️) or press **Shift+F10**
3. Wait for build to complete (first build may take 5-10 minutes)
4. App will install and launch on your device

---

## 🔧 Troubleshooting

### Gradle Sync Fails
```bash
cd android
./gradlew clean
```
Then try opening in Android Studio again.

### Build Errors
- Make sure you have Android SDK installed
- Check that `ANDROID_HOME` is set correctly
- Verify Java version (should be 17+)

### Device Not Detected
```bash
# Check if device is connected
adb devices

# If device shows as "unauthorized", check USB debugging on device
```

### Rebuild Native Code
If you need to regenerate the Android project:
```bash
npx expo prebuild --platform android --clean
```

---

## 📝 Important Notes

### Backend Connection
The app will connect to:
- **Production**: `https://atra.one` (automatic in production builds)
- **Development**: `http://localhost:3000` (if backend running locally)

For physical device testing, you may need to:
- Set `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000` in `.env`
- Or use the production backend at `atra.one`

### First Build
- First build downloads all dependencies (~500MB+)
- Subsequent builds are much faster
- Build time: 5-10 minutes first time, 1-2 minutes after

### Project Structure
```
android/
├── app/              # Main app module
├── build.gradle      # Root build config
├── settings.gradle   # Project settings
├── gradle.properties # Gradle properties
└── gradlew           # Gradle wrapper
```

---

## ✅ Verification

After opening in Android Studio, verify:
- ✅ Gradle sync completed without errors
- ✅ Device appears in device dropdown
- ✅ No red error markers in project files
- ✅ Build succeeds when clicking Run

---

## 🎯 Quick Commands

```bash
# Generate Android project
npx expo prebuild --platform android --clean

# Build from command line (alternative to Android Studio)
cd android
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug

# Check connected devices
adb devices
```

---

**You're all set!** Open the `android/` directory in Android Studio and start developing. 🚀




