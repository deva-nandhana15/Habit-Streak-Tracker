// =============================================================================
// HabitTracker — Firebase Authentication Service
// =============================================================================
// Provides all authentication methods used across the app:
//   • Email/password registration & login
//   • Phone OTP send & verify
//   • Google Sign-In (via expo-auth-session + expo-web-browser)
//   • Password reset
//   • Logout & auth-state listener
//
// Every function is fully typed, wraps its work in try/catch, and throws
// a descriptive error message on failure.
// =============================================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  PhoneAuthProvider,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  UserCredential,
  Unsubscribe,
  User as FirebaseUser,
} from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { auth } from "./config";

// -----------------------------------------------------------------------------
// Ensure any in-progress auth redirects are completed on app start (iOS/Android)
// -----------------------------------------------------------------------------
WebBrowser.maybeCompleteAuthSession();

// =============================================================================
// Email / Password
// =============================================================================

/**
 * Creates a new Firebase Auth account with email and password.
 *
 * @param email    - The user's email address.
 * @param password - A password with at least 6 characters.
 * @returns The `UserCredential` of the newly created account.
 * @throws A descriptive error if registration fails (e.g. email already in use).
 */
export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    const userCredential: UserCredential =
      await createUserWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown registration error";
    throw new Error(`Registration failed: ${message}`);
  }
}

/**
 * Signs in an existing user with email and password.
 *
 * @param email    - The user's email address.
 * @param password - The user's password.
 * @returns The `UserCredential` of the authenticated session.
 * @throws A descriptive error if login fails (e.g. wrong password).
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    const userCredential: UserCredential =
      await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown login error";
    throw new Error(`Login failed: ${message}`);
  }
}

// =============================================================================
// Phone OTP
// =============================================================================

/**
 * Sends an OTP to the given phone number via Firebase Phone Auth.
 *
 * **Note:** On real devices a reCAPTCHA verifier is required. In Expo Go the
 * Firebase JS SDK uses an invisible reCAPTCHA via a web redirect. For
 * production builds consider using `@react-native-firebase/auth` with native
 * phone auth instead, which provides a seamless experience.
 *
 * @param phoneNumber - E.164 formatted phone number (e.g. "+1234567890").
 * @returns A `verificationId` string needed to verify the OTP.
 * @throws A descriptive error if OTP dispatch fails.
 */
export async function sendPhoneOTP(phoneNumber: string): Promise<string> {
  try {
    // The PhoneAuthProvider in the JS SDK needs an ApplicationVerifier.
    // In a web/Expo environment we create an invisible reCAPTCHA element.
    // For native builds you can swap this with a native verifier.
    const { RecaptchaVerifier } = await import("firebase/auth");

    // Create a temporary DOM container for the invisible reCAPTCHA widget.
    // In React Native web this works out-of-the-box; on native the Firebase
    // JS SDK will open a web popup for verification.
    const recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });

    const provider = new PhoneAuthProvider(auth);
    const verificationId: string = await provider.verifyPhoneNumber(
      phoneNumber,
      recaptchaVerifier
    );

    return verificationId;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown phone auth error";
    throw new Error(`Failed to send OTP: ${message}`);
  }
}

/**
 * Verifies the OTP code the user received on their phone.
 *
 * @param verificationId - The ID returned by `sendPhoneOTP`.
 * @param otp            - The 6-digit code entered by the user.
 * @returns The `UserCredential` after successful verification.
 * @throws A descriptive error if verification fails (e.g. wrong code).
 */
export async function verifyPhoneOTP(
  verificationId: string,
  otp: string
): Promise<UserCredential> {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, otp);
    const userCredential: UserCredential = await signInWithCredential(
      auth,
      credential
    );
    return userCredential;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown verification error";
    throw new Error(`OTP verification failed: ${message}`);
  }
}

// =============================================================================
// Google Sign-In (expo-auth-session + expo-web-browser)
// =============================================================================

/**
 * Initiates Google Sign-In using expo-auth-session, exchanges the resulting
 * ID token for a Firebase credential, and signs the user in.
 *
 * **Setup required:**
 * 1. Create OAuth 2.0 Client IDs in Google Cloud Console (Web, iOS, Android).
 * 2. Add the following environment variables:
 *    - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
 *    - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`      (optional — iOS builds)
 *    - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  (optional — Android builds)
 * 3. Enable Google as a sign-in provider in the Firebase Console.
 *
 * @returns The `UserCredential` of the Google-authenticated user.
 * @throws A descriptive error if any step of the flow fails or the user cancels.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    // Build the Google auth request using expo-auth-session's provider helper.
    // `Google.useAuthRequest` is a hook → we cannot call it here. Instead we
    // use the lower-level `Google.discovery` + `AuthSession.makeRedirectUri`
    // approach via `Google.useIdTokenAuthRequest` indirectly. However, since
    // this module is a plain async function (not a component), we drive the
    // auth session imperatively with `AuthSession.startAsync`-style flow
    // through `promptAsync` returned by the hook.
    //
    // Because hooks can only be used inside components, this function accepts
    // a pre-built `promptAsync` call result. To keep the public API simple
    // we instead replicate the OAuth exchange manually:

    const { makeRedirectUri } = await import("expo-auth-session");

    const redirectUri: string = makeRedirectUri({ preferLocalhost: false });

    const clientId: string =
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

    if (!clientId) {
      throw new Error(
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. " +
          "Add it to your .env file from the Google Cloud Console."
      );
    }

    // Use the Google discovery document provided by expo-auth-session
    const discovery = Google.discovery;

    // Start the OAuth session — this opens the system browser / in-app tab
    const authRequestOptions = {
      clientId,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: "id_token" as const,
    };

    // Dynamically import AuthRequest so we stay compatible outside of hooks
    const { AuthRequest } = await import("expo-auth-session");
    const request = new AuthRequest(authRequestOptions);
    const result = await request.promptAsync(discovery);

    if (result.type !== "success") {
      throw new Error(
        result.type === "cancel"
          ? "Google Sign-In was cancelled by the user."
          : `Google Sign-In ended with status: ${result.type}`
      );
    }

    // Extract the id_token from the successful response
    const idToken: string | undefined = result.params?.id_token;

    if (!idToken) {
      throw new Error("No ID token received from Google.");
    }

    // Build a Firebase credential from the Google ID token and sign in
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential: UserCredential = await signInWithCredential(
      auth,
      credential
    );

    return userCredential;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Google sign-in error";
    throw new Error(`Google Sign-In failed: ${message}`);
  }
}

// =============================================================================
// Logout
// =============================================================================

/**
 * Signs out the currently authenticated user.
 *
 * @throws A descriptive error if sign-out fails.
 */
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown sign-out error";
    throw new Error(`Logout failed: ${message}`);
  }
}

// =============================================================================
// Auth State Observer
// =============================================================================

/**
 * Subscribes to Firebase auth-state changes.
 *
 * @param callback - Invoked with the `FirebaseUser` when signed in, or `null`
 *                   when signed out.
 * @returns An `Unsubscribe` function — call it to stop listening.
 */
export function onAuthStateChange(
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// =============================================================================
// Password Reset
// =============================================================================

/**
 * Sends a password-reset email to the given address.
 *
 * @param email - The email tied to the account.
 * @throws A descriptive error if the email cannot be sent.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown password-reset error";
    throw new Error(`Password reset failed: ${message}`);
  }
}
