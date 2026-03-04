// =============================================================================
// HabitTracker — Auth Stack Navigator
// =============================================================================
// Native-stack navigator for unauthenticated users.
// Screens: Login → Register → OTPVerification
// =============================================================================

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../constants/theme";

import LoginScreen from "../app/(auth)/login";
import RegisterScreen from "../app/(auth)/register";
import OTPVerificationScreen from "../app/(auth)/otp-verification";

// -----------------------------------------------------------------------------
// Param list type — keeps navigation fully typed
// -----------------------------------------------------------------------------

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { verificationId: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// =============================================================================
// Component
// =============================================================================

export default function AuthStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
}
