# 🔍 Splash Screen Hang - Root Cause Analysis

## 📋 Launch Sequence Analysis

### Android Studio Launch Command:
```bash
adb shell am start -n app.rork.makeup_check_app/app.rork.makeup_check_app.MainActivity \
  -a android.intent.action.MAIN \
  -c android.intent.category.LAUNCHER \
  -D --suspend --splashscreen-show-icon
```

**What happens:**
1. ✅ MainActivity launches successfully
2. ✅ Splash screen displays (white bg, black circle)
3. ✅ Debugger connects (localhost:36999)
4. ❌ **JavaScript bundle never loads**
5. ❌ **Splash screen never hides**

---

## 🔴 ROOT CAUSE: Metro Bundler Not Running

### The Problem

**Debug builds in Expo/React Native work differently than release builds:**

1. **Debug Builds (what you're running):**
   - JavaScript is **NOT bundled** into the APK
   - App expects to connect to **Metro bundler** running on your computer
   - Metro serves the JS bundle over network (USB or WiFi)
   - If Metro isn't running → JS never loads → App hangs

2. **Release Builds:**
   - JavaScript **IS bundled** into the APK
   - No Metro connection needed
   - App works standalone

### Evidence from Code

**MainApplication.kt (line 30-32):**
```kotlin
override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
```

This means:
- Debug builds use `.expo/.virtual-metro-entry` (Metro entry point)
- `getUseDeveloperSupport()` returns `true` in debug → expects Metro connection

**app/_layout.tsx:**
```typescript
SplashScreen.preventAutoHideAsync();  // Line 10 - Prevents auto-hide

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();  // Line 51 - Hides when JS loads
    // ... rest of code
  }, []);
}
```

**The Issue:**
- `preventAutoHideAsync()` prevents splash from auto-hiding
- `hideAsync()` is called in `useEffect`
- **If JavaScript never loads, `useEffect` never runs**
- **Result: Splash screen stays forever**

---

## ✅ SOLUTION: Start Metro Bundler

### Option 1: Run Metro Before Launching (Recommended)

**Terminal 1 - Start Metro:**
```bash
cd /home/verycosmic/ReactNatives/rork-makeup-check-app
npx expo start
# OR
bunx expo start
```

**Terminal 2 - Launch from Android Studio:**
- Click Run in Android Studio
- Metro will detect the connection and serve the bundle
- App will load normally

### Option 2: Use Expo CLI to Launch (Alternative)

```bash
# Start Metro and launch on device in one command
npx expo start --android
```

This starts Metro and automatically launches the app on your connected device.

### Option 3: Build Release Version (Standalone)

If you want the app to work without Metro:

```bash
# In Android Studio:
# Build → Generate Signed Bundle / APK
# Select "release" variant
```

Release builds bundle JS into the APK, so they work standalone.

---

## 🔍 Why This Happens

### Debug vs Release Build Flow

**Debug Build Flow:**
```
1. App launches → Shows splash screen
2. App tries to connect to Metro bundler (localhost:8081)
3. Metro serves JavaScript bundle
4. JavaScript loads → React components render
5. useEffect runs → SplashScreen.hideAsync() called
6. Splash screen hides → App UI appears
```

**If Metro isn't running:**
```
1. App launches → Shows splash screen
2. App tries to connect to Metro → FAILS
3. JavaScript never loads
4. useEffect never runs
5. Splash screen stays forever ❌
```

### Network Connection Requirements

For physical devices, Metro needs to be reachable:
- **USB Connection:** Uses `adb reverse` to forward port 8081
- **WiFi Connection:** Phone needs to reach your computer's LAN IP
- **Emulator:** Uses `10.0.2.2:8081` automatically

---

## 🧪 Testing & Verification

### Check if Metro is Running:
```bash
# Check if port 8081 is listening
lsof -i :8081
# OR
netstat -an | grep 8081
```

### Check Device Connection:
```bash
# List connected devices
adb devices

# Forward Metro port (if needed)
adb reverse tcp:8081 tcp:8081
```

### View Logs:
```bash
# Android logs
adb logcat | grep -i "react\|expo\|metro\|bundle"

# Metro bundler logs
# (visible in terminal where expo start is running)
```

---

## 📝 Expected Behavior

### ✅ Correct Flow (Metro Running):
1. Launch app from Android Studio
2. Splash screen appears (1-2 seconds)
3. Metro connection established
4. JavaScript bundle loads
5. Splash screen hides
6. App UI appears

### ❌ Current Behavior (Metro Not Running):
1. Launch app from Android Studio
2. Splash screen appears
3. Metro connection fails (silently)
4. JavaScript never loads
5. Splash screen stays forever

---

## 🎯 Is This a Bug?

**NO - This is expected behavior for Expo/React Native debug builds.**

### Why Expo Does This:
- **Faster development:** Changes reflect immediately without rebuilding
- **Hot reload:** Code changes appear instantly
- **Debugging:** Can use React DevTools, debugger, etc.
- **Smaller APK:** Debug builds are smaller (no bundled JS)

### When It's a Problem:
- Running standalone without Metro (use release build instead)
- Network connectivity issues (fix network or use USB)
- Metro crashes (restart Metro)

---

## 🔧 Quick Fix

**Right now, to get your app working:**

1. **Open a terminal:**
   ```bash
   cd /home/verycosmic/ReactNatives/rork-makeup-check-app
   npx expo start
   ```

2. **Keep that terminal running** (Metro bundler)

3. **In Android Studio, click Run again**

4. **App should now load properly!**

---

## 📊 Summary

| Aspect | Debug Build | Release Build |
|--------|-------------|---------------|
| JS Bundle | Served by Metro | Bundled in APK |
| Metro Required | ✅ Yes | ❌ No |
| Network Needed | ✅ Yes (USB/WiFi) | ❌ No |
| Standalone | ❌ No | ✅ Yes |
| Development | ✅ Hot reload | ❌ Rebuild needed |
| Splash Screen | Hides when JS loads | Hides when JS loads |

**Your Issue:** Debug build without Metro = stuck on splash screen  
**Solution:** Start Metro bundler before launching app




