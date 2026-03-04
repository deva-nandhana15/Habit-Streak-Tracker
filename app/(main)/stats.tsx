// =============================================================================
// HabitTracker — Stats Screen (placeholder)
// =============================================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSizes } from "../../constants/theme";

export default function StatsScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Stats</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.text,
    fontSize: fontSizes.xl,
  },
});
