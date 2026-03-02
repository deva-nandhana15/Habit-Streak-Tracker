// =============================================================================
// Type augmentation for @firebase/auth in React Native
// =============================================================================
// The @firebase/auth package exports `getReactNativePersistence` only under the
// "react-native" condition, but its top-level "types" condition takes precedence
// in TypeScript's resolution order, so the export is invisible to the compiler.
//
// This declaration re-exposes the function so TypeScript recognises it when
// imported from "@firebase/auth".
// =============================================================================

import type { Persistence, ReactNativeAsyncStorage } from "@firebase/auth";

declare module "@firebase/auth" {
  /**
   * Returns a `Persistence` implementation backed by React Native AsyncStorage.
   * @param storage - An AsyncStorage-compatible instance.
   */
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence;
}
