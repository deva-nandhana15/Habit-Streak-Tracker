// =============================================================================
// HabitTracker — useStreak Hook
// =============================================================================
// Fetches completions for a single habit and computes streak metrics using
// the streakCalculator utilities. Provides a `markComplete` action that
// records a completion and updates the habit's streak fields in Firestore.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getCompletions,
  addCompletion,
  updateHabit,
} from "../firebase/firestore";
import {
  calculateStreak,
  getBestStreak,
  isCompletedToday as checkIsCompletedToday,
  isStreakAtRisk,
} from "../utils/streakCalculator";
import type { Completion, Frequency } from "../types";

// -----------------------------------------------------------------------------
// Hook return type
// -----------------------------------------------------------------------------

interface UseStreakReturn {
  /** Current consecutive streak count */
  currentStreak: number;
  /** Highest streak ever achieved */
  bestStreak: number;
  /** Whether the habit has been completed today */
  isCompletedToday: boolean;
  /** Whether the streak is at risk of being lost */
  isAtRisk: boolean;
  /** All completions for this habit (newest first) */
  completions: Completion[];
  /** `true` while completions are being fetched */
  loading: boolean;
  /** Latest error message, or `null` */
  error: string | null;
  /** Record a completion, update streak fields on the habit document */
  markComplete: (note?: string) => Promise<void>;
  /** Manually re-fetch completions and recompute streak values */
  refetch: () => Promise<void>;
}

// =============================================================================
// Hook implementation
// =============================================================================

export function useStreak(
  uid: string | undefined,
  habitId: string,
  frequency: Frequency,
  customDays?: number[],
): UseStreakReturn {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch completions
  // ---------------------------------------------------------------------------

  const fetchCompletions = useCallback(async (): Promise<void> => {
    if (!uid || !habitId) {
      setCompletions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getCompletions(uid, habitId);
      setCompletions(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch completions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [uid, habitId]);

  // Fetch on mount and when uid / habitId change
  useEffect(() => {
    void fetchCompletions();
  }, [fetchCompletions]);

  // ---------------------------------------------------------------------------
  // Computed streak values (recomputed whenever completions change)
  // ---------------------------------------------------------------------------

  const currentStreak = useMemo(
    () => calculateStreak(completions, frequency, customDays),
    [completions, frequency, customDays],
  );

  const bestStreak = useMemo(
    () => getBestStreak(completions, frequency, customDays),
    [completions, frequency, customDays],
  );

  const isCompletedToday = useMemo(
    () => checkIsCompletedToday(completions),
    [completions],
  );

  const isAtRisk = useMemo(
    () => isStreakAtRisk(completions, frequency, customDays),
    [completions, frequency, customDays],
  );

  // ---------------------------------------------------------------------------
  // Mark complete action
  // ---------------------------------------------------------------------------

  const markComplete = useCallback(
    async (note?: string): Promise<void> => {
      if (!uid) throw new Error("User is not authenticated");
      if (!habitId) throw new Error("Habit ID is required");

      try {
        setError(null);

        // 1. Record the completion in Firestore
        await addCompletion(uid, { habitId, note });

        // 2. Re-fetch completions so computed values update
        const updatedCompletions = await getCompletions(uid, habitId);
        setCompletions(updatedCompletions);

        // 3. Recompute streak values from the fresh completions
        const newCurrentStreak = calculateStreak(
          updatedCompletions,
          frequency,
          customDays,
        );
        const newBestStreak = getBestStreak(
          updatedCompletions,
          frequency,
          customDays,
        );

        // 4. Update the habit document with the latest streak values
        await updateHabit(uid, habitId, {
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to mark complete";
        setError(message);
        throw err;
      }
    },
    [uid, habitId, frequency, customDays],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    currentStreak,
    bestStreak,
    isCompletedToday,
    isAtRisk,
    completions,
    loading,
    error,
    markComplete,
    refetch: fetchCompletions,
  };
}
