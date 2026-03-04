// =============================================================================
// HabitTracker — useNotifications Hook
// =============================================================================
// Manages push-notification permissions, scheduling habit reminders, and
// cancelling / rescheduling them. Notification identifiers are persisted in
// AsyncStorage so they can be cancelled later without Firestore.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Habit } from "../types";

// -----------------------------------------------------------------------------
// AsyncStorage key prefix
// -----------------------------------------------------------------------------

/** All notification identifiers are stored under keys of this shape. */
const STORAGE_KEY_PREFIX = "habit_notification_";

/** Build the AsyncStorage key for a given habit. */
function storageKey(habitId: string): string {
  return `${STORAGE_KEY_PREFIX}${habitId}`;
}

// -----------------------------------------------------------------------------
// Hook return type
// -----------------------------------------------------------------------------

interface UseNotificationsReturn {
  /** Whether the user has granted notification permissions */
  hasPermission: boolean;
  /** Request notification permissions from the OS */
  requestPermissions: () => Promise<boolean>;
  /** Schedule a repeating reminder for a habit at its `reminderTime` */
  scheduleHabitReminder: (habit: Habit) => Promise<void>;
  /** Cancel the scheduled reminder for a specific habit */
  cancelHabitReminder: (habitId: string) => Promise<void>;
  /** Cancel all existing reminders and reschedule from the provided list */
  rescheduleAllHabits: (habits: Habit[]) => Promise<void>;
}

// =============================================================================
// Configure default notification behaviour (shows alert even when foregrounded)
// =============================================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// =============================================================================
// Hook implementation
// =============================================================================

export function useNotifications(): UseNotificationsReturn {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Check existing permission status on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Request permissions
  // ---------------------------------------------------------------------------

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Physical device check — simulators may behave differently
    if (!Device.isDevice) {
      console.warn("Push notifications require a physical device.");
      setHasPermission(false);
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Android requires a notification channel (API 26+)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("habit-reminders", {
        name: "Habit Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });
    }

    const granted = finalStatus === "granted";
    setHasPermission(granted);
    return granted;
  }, []);

  // ---------------------------------------------------------------------------
  // Schedule a repeating reminder for a single habit
  // ---------------------------------------------------------------------------

  const scheduleHabitReminder = useCallback(
    async (habit: Habit): Promise<void> => {
      if (!habit.reminderTime) return; // No reminder configured

      // Cancel any existing notification for this habit first
      await cancelStoredNotification(habit.id);

      // Parse the HH:mm reminder time
      const [hoursStr, minutesStr] = habit.reminderTime.split(":");
      const hour = parseInt(hoursStr, 10);
      const minute = parseInt(minutesStr, 10);

      if (isNaN(hour) || isNaN(minute)) {
        console.warn(
          `Invalid reminderTime "${habit.reminderTime}" for habit ${habit.id}`,
        );
        return;
      }

      // Build the trigger — repeats daily at the specified time
      const trigger: Notifications.DailyTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${habit.name} ${habit.icon}`,
          body: "Keep your streak alive! 🔥",
          sound: true,
          data: { habitId: habit.id },
        },
        trigger,
      });

      // Persist the identifier so we can cancel it later
      await AsyncStorage.setItem(storageKey(habit.id), notificationId);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Cancel a single habit's reminder
  // ---------------------------------------------------------------------------

  const cancelHabitReminder = useCallback(
    async (habitId: string): Promise<void> => {
      await cancelStoredNotification(habitId);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Reschedule all habits (cancel everything, then reschedule)
  // ---------------------------------------------------------------------------

  const rescheduleAllHabits = useCallback(
    async (habits: Habit[]): Promise<void> => {
      // 1. Cancel every currently-scheduled notification
      await Notifications.cancelAllScheduledNotificationsAsync();

      // 2. Clear all stored notification IDs from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const notifKeys = allKeys.filter((k) => k.startsWith(STORAGE_KEY_PREFIX));
      if (notifKeys.length > 0) {
        await AsyncStorage.multiRemove(notifKeys);
      }

      // 3. Reschedule each habit that has a reminderTime
      for (const habit of habits) {
        if (habit.reminderTime) {
          await scheduleHabitReminder(habit);
        }
      }
    },
    [scheduleHabitReminder],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    hasPermission,
    requestPermissions,
    scheduleHabitReminder,
    cancelHabitReminder,
    rescheduleAllHabits,
  };
}

// =============================================================================
// Internal helper — cancel a notification by looking up its ID in AsyncStorage
// =============================================================================

async function cancelStoredNotification(habitId: string): Promise<void> {
  try {
    const key = storageKey(habitId);
    const notificationId = await AsyncStorage.getItem(key);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(key);
    }
  } catch (err: unknown) {
    // Non-critical — log and continue
    console.warn(`Failed to cancel notification for habit ${habitId}:`, err);
  }
}
