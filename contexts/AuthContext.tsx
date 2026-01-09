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
  platform?: 'google_play' | 'app_store';
  expiresAt?: string;
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

    // Listen for auth changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
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
      // Check local storage first
      const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if subscription is still valid (not expired)
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setSubscription(parsed);
          return;
        }
      }

      // Query Supabase for subscription status
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking subscription:', error);
        setSubscription({ isActive: false });
        return;
      }

      if (data && data.expires_at && new Date(data.expires_at) > new Date()) {
        const subStatus: SubscriptionStatus = {
          isActive: true,
          platform: data.platform as 'google_play' | 'app_store',
          expiresAt: data.expires_at,
        };
        setSubscription(subStatus);
        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subStatus));
      } else {
        setSubscription({ isActive: false });
        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ isActive: false }));
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({ isActive: false });
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

  const signInWithProvider = useCallback(async (provider: 'google' | 'apple') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${Constants.expoConfig?.scheme || 'rental-car-checker'}://auth/callback`,
        },
      });

      if (error) {
        return { error };
      }

      // OAuth flow will complete via deep link
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


