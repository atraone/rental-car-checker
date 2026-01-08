import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HistoryProvider } from "@/contexts/HistoryContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PhoneMockup } from "@/components/PhoneMockup";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="index" />
      <Stack.Screen name="capture-initial" />
      <Stack.Screen name="section-list" />
      <Stack.Screen name="capture-section" />
      <Stack.Screen name="results" />
      <Stack.Screen 
        name="privacy-policy" 
        options={{ 
          headerShown: true,
          headerTitle: "Privacy Policy",
          headerStyle: { backgroundColor: '#1a4a5c' },
          headerTintColor: '#fff',
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="terms-of-use" 
        options={{ 
          headerShown: true,
          headerTitle: "Terms of Use",
          headerStyle: { backgroundColor: '#1a4a5c' },
          headerTintColor: '#fff',
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="history" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    
    // Add phone mockup CSS for web/localhost testing
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        // Inject CSS directly as a style tag
        const styleId = 'phone-mockup-style';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            @media (min-width: 768px) {
              * {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                height: 100vh;
                max-height: 100vh;
                overflow: hidden !important;
                position: fixed;
                width: 100%;
              }
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                max-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 0;
                overflow: hidden !important;
              }
              /* Phone frame notch and home indicator */
              #phone-frame {
                position: relative;
              }
              #phone-frame::before {
                content: '';
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 150px;
                height: 25px;
                background: #1a1a1a;
                border-radius: 0 0 20px 20px;
                z-index: 1000;
                pointer-events: none;
              }
              #phone-frame::after {
                content: '';
                position: absolute;
                bottom: 8px;
                left: 50%;
                transform: translateX(-50%);
                width: 134px;
                height: 5px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                z-index: 1000;
                pointer-events: none;
              }
            }
          `;
          document.head.appendChild(style);
        }
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <HistoryProvider>
            <PhoneMockup>
              <RootLayoutNav />
            </PhoneMockup>
          </HistoryProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
