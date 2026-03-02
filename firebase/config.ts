// =============================================================================
// HabitTracker — Firebase Configuration
// =============================================================================
// Initialises Firebase App, Auth, and Firestore using environment variables.
//
// Expo automatically injects variables prefixed with EXPO_PUBLIC_ into the
// JS bundle via process.env at build time.
// =============================================================================

import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { initializeAuth, Auth } from "firebase/auth";
import { getReactNativePersistence } from "@firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// -----------------------------------------------------------------------------
// Firebase configuration object — populated from environment variables
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID, // optional
};

// -----------------------------------------------------------------------------
// Initialise Firebase (guards against duplicate initialisation on hot-reload)
// -----------------------------------------------------------------------------
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// -----------------------------------------------------------------------------
// Auth — uses AsyncStorage for persistent login state on React Native
// -----------------------------------------------------------------------------
const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// -----------------------------------------------------------------------------
// Firestore — default database instance
// -----------------------------------------------------------------------------
const db: Firestore = getFirestore(app);

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------
export { app, auth, db };
