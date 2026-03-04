// =============================================================================
// HabitTracker — Main Tab Navigator
// =============================================================================
// Bottom-tab navigator for authenticated users.
// Tabs: Dashboard | Stats | Profile
// Icons via lucide-react-native.
// =============================================================================

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, BarChart2, User } from "lucide-react-native";
import { colors } from "../constants/theme";

import DashboardScreen from "../app/(main)/dashboard";
import StatsScreen from "../app/(main)/stats";
import ProfileScreen from "../app/(main)/profile";

// -----------------------------------------------------------------------------
// Param list type
// -----------------------------------------------------------------------------

export type MainTabParamList = {
  Dashboard: undefined;
  Stats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// -----------------------------------------------------------------------------
// Icon size constant
// -----------------------------------------------------------------------------

const TAB_ICON_SIZE = 24;

// =============================================================================
// Component
// =============================================================================

export default function MainStack(): React.JSX.Element {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }: { color: string }) => (
            <Home size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarLabel: "Stats",
          tabBarIcon: ({ color }: { color: string }) => (
            <BarChart2 size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }: { color: string }) => (
            <User size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
