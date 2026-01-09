/**
 * Authentication Context
 * 
 * Handles user authentication, subscription status, and session management.
 * Provides persistent auto sign-in for subscribed users.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const AUTH_STORAGE_KEY = 'rental_car_checker_auth';
const SUBSCRIPTION_STORAGE_KEY = 'rental_car_checker_subscription';
const DEBUG_BYPASS_KEY = 'rental_car_checker_debug_bypass';

interface SubscriptionStatus {
  isActive: boolean;
  // Platform and expiration are handled by app store workflows
  // We only need to know if subscription is active
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  canAccessApp: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: Error }>;
  signUp: (email: string, password: string) => Promise<{ error?: Error }>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  setDebugBypass: (bypass: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugBypass, setDebugBypassState] = useState(false);

  // Check if this is a debug build
  const isDebugBuild = __DEV__ || Constants.expoConfig?.extra?.isDebug === true;

  // Load debug bypass from storage
  useEffect(() => {
    AsyncStorage.getItem(DEBUG_BYPASS_KEY).then(value => {
      if (value === 'true' && isDebugBuild) {
        setDebugBypassState(true);
      }
    });
  }, [isDebugBuild]);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkSubscription();
      }
      setIsLoading(false);
    });

    // Listen for auth state changes (per Authentication Integration Guide)
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User signed in successfully
        // Database trigger automatically creates rental_car_users record
        await checkSubscription();
      } else if (event === 'SIGNED_OUT') {
        // User signed out
        setSubscription(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token was automatically refreshed
        await checkSubscription();
      } else if (session?.user) {
        // Other events (USER_UPDATED, etc.)
        await checkSubscription();
      } else {
        setSubscription(null);
      }
      
      setIsLoading(false);
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      return;
    }

    try {
      // Check local storage first (simple cache with timestamp)
      const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Cache is valid for 5 minutes
          if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.isActive !== undefined) {
            setSubscription({ isActive: parsed.isActive });
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      // Use validateAuth endpoint - returns all we need (no direct DB access)
      const { validateAuth } = await import('@/services/supabase');
      const authStatus = await validateAuth();

      if (authStatus.error) {
        console.error('Error validating auth:', authStatus.error);
        setSubscription({ isActive: false });
        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ 
          isActive: false, 
          timestamp: Date.now() 
        }));
        return;
      }

      // User has access if they're a testing user OR have an active subscription
      const hasAccess = authStatus.isTestingUser || authStatus.hasSubscription;
      
      setSubscription({ isActive: hasAccess });
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ 
        isActive: hasAccess,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({ isActive: false });
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ 
        isActive: false,
        timestamp: Date.now()
      }));
    }
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await checkSubscription();
      }

      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }, [checkSubscription]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Note: If email confirmation is enabled in Supabase, session may be null until confirmed
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await checkSubscription();
      } else if (data.user) {
        // User created but needs email confirmation
        // Database trigger will automatically create rental_car_users record
        return { error: new Error('Please check your email to confirm your account.') };
      }

      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }, [checkSubscription]);

  const signInWithProvider = useCallback(async (provider: 'google' | 'apple') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'rental-car-checker://auth/callback',
        },
      });

      if (error) {
        return { error };
      }

      // OAuth flow:
      // 1. User will be redirected to provider (Google/Apple) for authorization
      // 2. Provider redirects back to app via deep link: rental-car-checker://auth/callback
      // 3. Supabase automatically handles session creation
      // 4. onAuthStateChange listener will detect successful login
      
      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSubscription(null);
    await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const setDebugBypass = useCallback(async (bypass: boolean) => {
    if (!isDebugBuild) return;
    setDebugBypassState(bypass);
    await AsyncStorage.setItem(DEBUG_BYPASS_KEY, bypass ? 'true' : 'false');
  }, [isDebugBuild]);

  const isAuthenticated = !!user && !!session;
  const isSubscribed = subscription?.isActive === true || debugBypass;
  const canAccessApp = isSubscribed || debugBypass;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        subscription,
        isLoading,
        isAuthenticated,
        isSubscribed,
        canAccessApp,
        signIn,
        signUp,
        signInWithProvider,
        signOut,
        checkSubscription,
        setDebugBypass,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


