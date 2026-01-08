import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Get the API base URL for the current environment
 * 
 * Priority:
 * 1. EXPO_PUBLIC_API_BASE_URL (explicit override)
 * 2. Production: https://atra.one
 * 3. Web dev: http://localhost:3000
 * 4. Android emulator: http://10.0.2.2:3000
 * 5. Physical device: http://localhost:3000 (with warning - should use LAN IP)
 */
export function getApiBaseUrl(): string {
  // Explicit override takes highest priority
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // Production build uses atra.one
  if (process.env.NODE_ENV === 'production' || __DEV__ === false) {
    return 'https://atra.one';
  }

  // Development environments
  if (Platform.OS === 'web') {
    // Web dev uses localhost
    return 'http://localhost:3000';
  }

  if (Platform.OS === 'android') {
    // Android emulator uses special IP to reach host machine
    // Check if we're in an emulator (simplified check)
    const isEmulator = Constants.deviceName?.includes('emulator') || 
                       Constants.deviceName?.includes('sdk') ||
                       !Constants.isDevice;
    
    if (isEmulator) {
      return 'http://10.0.2.2:3000';
    }
    
    // Physical Android device - warn that LAN IP should be used
    console.warn(
      '⚠️  Using localhost for Android device. ' +
      'Set EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000 for physical device testing.'
    );
    return 'http://localhost:3000';
  }

  if (Platform.OS === 'ios') {
    // iOS simulator can use localhost
    const isSimulator = !Constants.isDevice;
    
    if (isSimulator) {
      return 'http://localhost:3000';
    }
    
    // Physical iOS device - warn that LAN IP should be used
    console.warn(
      '⚠️  Using localhost for iOS device. ' +
      'Set EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000 for physical device testing.'
    );
    return 'http://localhost:3000';
  }

  // Fallback
  return 'http://localhost:3000';
}

