// =============================================================================
// HabitTracker — Root Application Component
// =============================================================================
// Determines auth state via useAuth, then renders either the AuthStack
// (unauthenticated) or MainStack (authenticated). A full-screen loading
// spinner is shown while the initial auth check is in progress so there is
// never a flash of the wrong screen.
// =============================================================================

import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AuthStack from "./navigation/AuthStack";
import MainStack from "./navigation/MainStack";
import { useAuth } from "./hooks/useAuth";
import { colors } from "./constants/theme";

// =============================================================================
// Component
// =============================================================================

export default function App(): React.JSX.Element {
  const { user, loading } = useAuth();

  // ---------------------------------------------------------------------------
  // Full-screen loader while Firebase resolves the initial auth state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation tree — auth-gated
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.card,
            notification: colors.primary,
          },
          fonts: {
            regular: { fontFamily: "System", fontWeight: "400" },
            medium: { fontFamily: "System", fontWeight: "500" },
            bold: { fontFamily: "System", fontWeight: "700" },
            heavy: { fontFamily: "System", fontWeight: "900" },
          },
        }}
      >
        {user ? <MainStack /> : <AuthStack />}
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
