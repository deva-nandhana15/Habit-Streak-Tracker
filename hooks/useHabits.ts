// =============================================================================
// HabitTracker — useHabits Hook
// =============================================================================
// Fetches and manages the current user's habits from Firestore.
// Provides CRUD operations with automatic refetching after mutations.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  getUserHabits,
  addHabit as addHabitToFirestore,
  updateHabit as updateHabitInFirestore,
  deleteHabit as deleteHabitFromFirestore,
} from "../firebase/firestore";
import type { Habit, Frequency } from "../types";

// -----------------------------------------------------------------------------
// Payload types (mirror firestore service signatures for clarity)
// -----------------------------------------------------------------------------

interface AddHabitPayload {
  name: string;
  icon: string;
  category: string;
  frequency: Frequency;
  customDays?: number[];
  reminderTime: string | null;
}

interface UpdateHabitPayload {
  name?: string;
  icon?: string;
  category?: string;
  frequency?: Frequency;
  customDays?: number[];
  reminderTime?: string | null;
  currentStreak?: number;
  bestStreak?: number;
}

// -----------------------------------------------------------------------------
// Hook return type
// -----------------------------------------------------------------------------

interface UseHabitsReturn {
  /** All habits belonging to the current user */
  habits: Habit[];
  /** `true` while habits are being fetched */
  loading: boolean;
  /** Latest error message, or `null` */
  error: string | null;
  /** Create a new habit and refetch the list */
  addHabit: (habit: AddHabitPayload) => Promise<string>;
  /** Delete a habit (and its completions) then refetch */
  deleteHabit: (habitId: string) => Promise<void>;
  /** Partially update a habit then refetch */
  updateHabit: (habitId: string, data: UpdateHabitPayload) => Promise<void>;
  /** Manually re-fetch all habits */
  refetch: () => Promise<void>;
}

// =============================================================================
// Hook implementation
// =============================================================================

export function useHabits(uid: string | undefined): UseHabitsReturn {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch all habits for the given uid
  // ---------------------------------------------------------------------------
  const fetchHabits = useCallback(async (): Promise<void> => {
    if (!uid) {
      setHabits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getUserHabits(uid);
      setHabits(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch habits";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Fetch on mount and whenever uid changes
  useEffect(() => {
    void fetchHabits();
  }, [fetchHabits]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const addHabit = useCallback(
    async (habit: AddHabitPayload): Promise<string> => {
      if (!uid) throw new Error("User is not authenticated");

      try {
        setError(null);
        const id = await addHabitToFirestore(uid, habit);
        await fetchHabits();
        return id;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to add habit";
        setError(message);
        throw err;
      }
    },
    [uid, fetchHabits],
  );

  const deleteHabit = useCallback(
    async (habitId: string): Promise<void> => {
      if (!uid) throw new Error("User is not authenticated");

      try {
        setError(null);
        await deleteHabitFromFirestore(uid, habitId);
        await fetchHabits();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to delete habit";
        setError(message);
        throw err;
      }
    },
    [uid, fetchHabits],
  );

  const updateHabit = useCallback(
    async (habitId: string, data: UpdateHabitPayload): Promise<void> => {
      if (!uid) throw new Error("User is not authenticated");

      try {
        setError(null);
        await updateHabitInFirestore(uid, habitId, data);
        await fetchHabits();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update habit";
        setError(message);
        throw err;
      }
    },
    [uid, fetchHabits],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    habits,
    loading,
    error,
    addHabit,
    deleteHabit,
    updateHabit,
    refetch: fetchHabits,
  };
}
