// =============================================================================
// HabitTracker — useAuth Hook
// =============================================================================
// Manages Firebase authentication state, user profile fetching, and exposes
// login / register / logout actions. Completely self-contained.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
  onAuthStateChange,
  loginWithEmail,
  sendPhoneOTP,
  verifyPhoneOTP,
  signInWithGoogle,
  registerWithEmail,
  logout as firebaseLogout,
} from "../firebase/auth";
import { createUserProfile, getUserProfile } from "../firebase/firestore";
import type { User } from "../types";

// -----------------------------------------------------------------------------
// Hook return type
// -----------------------------------------------------------------------------

interface UseAuthReturn {
  /** App-level user profile fetched from Firestore */
  user: User | null;
  /** Raw Firebase Auth user object */
  firebaseUser: FirebaseUser | null;
  /** `true` while the initial auth state or profile is loading */
  loading: boolean;
  /** Latest error message, or `null` */
  error: string | null;
  /** Sign in with email & password */
  login: (email: string, password: string) => Promise<void>;
  /** Send OTP to a phone number; returns the verificationId */
  loginWithPhone: (phoneNumber: string) => Promise<string>;
  /** Verify a phone OTP using the verificationId from `loginWithPhone` */
  verifyOTP: (verificationId: string, otp: string) => Promise<void>;
  /** Sign in with Google via expo-auth-session */
  loginWithGoogle: () => Promise<void>;
  /** Register a new account and create the Firestore user profile */
  register: (
    email: string,
    password: string,
    displayName: string,
    phone: string,
  ) => Promise<void>;
  /** Sign out the current user */
  logout: () => Promise<void>;
  /** Clear the current error state */
  clearError: () => void;
}

// =============================================================================
// Hook implementation
// =============================================================================

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auth-state listener — runs once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (fbUser: FirebaseUser | null) => {
      try {
        setFirebaseUser(fbUser);

        if (fbUser) {
          // Fetch the corresponding Firestore user profile
          const profile = await getUserProfile(fbUser.uid);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch user profile";
        setError(message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await loginWithEmail(email, password);
      // Auth-state listener will handle updating user & firebaseUser
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithPhoneFn = useCallback(
    async (phoneNumber: string): Promise<string> => {
      try {
        setLoading(true);
        setError(null);
        const verificationId = await sendPhoneOTP(phoneNumber);
        return verificationId;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Phone login failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const verifyOTP = useCallback(
    async (verificationId: string, otp: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await verifyPhoneOTP(verificationId, otp);
        // Auth-state listener handles the rest
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "OTP verification failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loginWithGoogleFn = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      // Auth-state listener handles the rest
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google login failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      phone: string,
    ): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const credential = await registerWithEmail(email, password);

        // Create the Firestore user profile immediately after registration
        await createUserProfile(credential.user.uid, {
          email,
          phone,
          displayName,
          createdAt: new Date().toISOString(),
          totalPoints: 0,
          streakFreezes: 0,
        });

        // Fetch the profile so state is updated without waiting for listener
        const profile = await getUserProfile(credential.user.uid);
        setUser(profile);
        setFirebaseUser(credential.user);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logoutFn = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await firebaseLogout();
      // Auth-state listener will clear user & firebaseUser
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Logout failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    user,
    firebaseUser,
    loading,
    error,
    login,
    loginWithPhone: loginWithPhoneFn,
    verifyOTP,
    loginWithGoogle: loginWithGoogleFn,
    register,
    logout: logoutFn,
    clearError,
  };
}
