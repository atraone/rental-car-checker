/**
 * Authentication Screen
 * 
 * Provides signup/signin with email and social SSO (Google, Apple).
 * Shows subscription wall for non-subscribed users.
 * Includes debug bypass button (only in debug builds).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, LogIn, UserPlus, Smartphone } from 'lucide-react-native';
import Constants from 'expo-constants';

const isDebugBuild = __DEV__ || Constants.expoConfig?.extra?.isDebug === true;

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithProvider, setDebugBypass, canAccessApp } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebugBypass, setShowDebugBypass] = useState(false);

  // If already authenticated and subscribed, redirect to home
  React.useEffect(() => {
    if (canAccessApp) {
      router.replace('/');
    }
  }, [canAccessApp, router]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (result.error) {
        Alert.alert('Error', result.error.message || 'Authentication failed');
      } else {
        // Success - will redirect via useEffect
        router.replace('/');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const result = await signInWithProvider(provider);
      if (result.error) {
        Alert.alert('Error', result.error.message || 'Social authentication failed');
      }
      // OAuth flow will complete via deep link
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebugBypass = async () => {
    await setDebugBypass(true);
    router.replace('/');
  };

  const handleSubscribe = () => {
    // Placeholder for subscription flow
    if (Platform.OS === 'android') {
      Alert.alert(
        'Subscribe',
        'Google Play subscription integration coming soon. For now, use debug bypass in development.',
        [{ text: 'OK' }]
      );
    } else if (Platform.OS === 'ios') {
      Alert.alert(
        'Subscribe',
        'App Store subscription integration coming soon. For now, use debug bypass in development.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Rental Car Checker</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create an account' : 'Sign in to continue'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#7AB8CC" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#7AB8CC"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#7AB8CC" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#7AB8CC"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEmailAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                {isSignUp ? (
                  <UserPlus size={20} color="#FFFFFF" />
                ) : (
                  <LogIn size={20} color="#FFFFFF" />
                )}
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialAuth('google')}
            disabled={isLoading}
          >
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialAuth('apple')}
              disabled={isLoading}
            >
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.subscriptionSection}>
          <Text style={styles.subscriptionTitle}>Subscription Required</Text>
          <Text style={styles.subscriptionText}>
            A subscription is required to use this app. Subscribe to access all features.
          </Text>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
          >
            <Smartphone size={20} color="#FFFFFF" />
            <Text style={styles.subscribeButtonText}>
              Subscribe via {Platform.OS === 'android' ? 'Google Play' : 'App Store'}
            </Text>
          </TouchableOpacity>
        </View>

        {isDebugBuild && (
          <View style={styles.debugSection}>
            <TouchableOpacity
              style={styles.debugToggle}
              onPress={() => setShowDebugBypass(!showDebugBypass)}
            >
              <Text style={styles.debugToggleText}>Debug Options</Text>
            </TouchableOpacity>
            {showDebugBypass && (
              <TouchableOpacity
                style={styles.debugBypassButton}
                onPress={handleDebugBypass}
              >
                <Text style={styles.debugBypassText}>Bypass Auth (Debug Only)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a4a5c',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7AB8CC',
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a5a6c',
  },
  dividerText: {
    color: '#7AB8CC',
    marginHorizontal: 16,
    fontSize: 14,
  },
  socialButton: {
    backgroundColor: '#2a5a6c',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4A90A4',
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#7AB8CC',
    fontSize: 14,
  },
  subscriptionSection: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 8,
  },
  subscriptionText: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  debugSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a5a6c',
  },
  debugToggle: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  debugToggleText: {
    color: '#7AB8CC',
    fontSize: 12,
  },
  debugBypassButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  debugBypassText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});


