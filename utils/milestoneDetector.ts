// =============================================================================
// HabitTracker — Milestone Detector
// =============================================================================
// Determines which milestones / achievements a user has just unlocked and
// provides display metadata for each milestone type.
//
// Milestone thresholds (hard-coded — extend this list as needed):
//   ┌────────────────────┬──────────────┬────────────────────────┐
//   │ type               │ condition    │ reward                 │
//   ├────────────────────┼──────────────┼────────────────────────┤
//   │ first_completion   │ 1 completion │ Welcome badge          │
//   │ streak_7           │ 7-day streak │ Streak freeze unlock   │
//   │ streak_30          │ 30-day streak│ Avatar frame           │
//   │ streak_100         │ 100-day stk  │ Legend badge           │
//   │ century            │ 100 compltns │ Century trophy         │
//   └────────────────────┴──────────────┴────────────────────────┘
// =============================================================================

import type { Milestone } from "../types";

// =============================================================================
// ── Threshold definitions ────────────────────────────────────────────────────
// =============================================================================

/** Internal representation of a single milestone threshold. */
interface MilestoneThreshold {
  /** Machine-readable identifier stored in Firestore */
  type: string;
  /** Human-readable label for the UI */
  label: string;
  /** Emoji shown alongside the milestone */
  emoji: string;
  /** Description of the reward the user earns */
  reward: string;
  /**
   * Predicate that returns `true` when the user's current stats satisfy
   * this milestone's unlock condition.
   */
  isUnlocked: (currentStreak: number, totalCompletions: number) => boolean;
}

/**
 * Master list of all milestone thresholds.
 * Order doesn't matter — `checkMilestones` iterates the full list every time.
 */
const MILESTONE_THRESHOLDS: readonly MilestoneThreshold[] = [
  {
    type: "first_completion",
    label: "First Step",
    emoji: "🎉",
    reward: "Welcome badge",
    isUnlocked: (_streak, total) => total >= 1,
  },
  {
    type: "streak_7",
    label: "7-Day Streak",
    emoji: "🔥",
    reward: "Streak freeze unlock",
    isUnlocked: (streak) => streak >= 7,
  },
  {
    type: "streak_30",
    label: "30-Day Streak",
    emoji: "⭐",
    reward: "Avatar frame",
    isUnlocked: (streak) => streak >= 30,
  },
  {
    type: "streak_100",
    label: "100-Day Streak",
    emoji: "🏆",
    reward: "Legend badge",
    isUnlocked: (streak) => streak >= 100,
  },
  {
    type: "century",
    label: "Century Club",
    emoji: "💯",
    reward: "Century trophy",
    isUnlocked: (_streak, total) => total >= 100,
  },
] as const;

// =============================================================================
// ── checkMilestones ──────────────────────────────────────────────────────────
// =============================================================================

/**
 * Compares the user's current stats against every milestone threshold and
 * returns an array of **newly unlocked** milestones — i.e. milestones whose
 * condition is now satisfied but whose `type` does not yet appear in the
 * `unlockedMilestones` array.
 *
 * The returned objects are partial Milestone stubs (no `id` or `unlockedAt`).
 * The caller is responsible for persisting them to Firestore via
 * `addMilestone()` and filling in the remaining fields.
 *
 * @param currentStreak       - The habit's current streak count.
 * @param totalCompletions    - Lifetime completion count for the habit.
 * @param unlockedMilestones  - Milestones the user has already earned.
 * @returns Milestones that should be awarded now (may be empty).
 */
export function checkMilestones(
  currentStreak: number,
  totalCompletions: number,
  unlockedMilestones: Milestone[]
): Milestone[] {
  // Build a Set of already-unlocked types for O(1) lookups
  const alreadyUnlocked = new Set<string>(
    unlockedMilestones.map((m) => m.type)
  );

  const newlyUnlocked: Milestone[] = [];

  for (const threshold of MILESTONE_THRESHOLDS) {
    // Skip if this milestone was already awarded
    if (alreadyUnlocked.has(threshold.type)) continue;

    // Check if the threshold condition is now met
    if (threshold.isUnlocked(currentStreak, totalCompletions)) {
      // Return a stub — caller will assign id, unlockedAt, and habitId
      newlyUnlocked.push({
        id: "",          // to be assigned by Firestore
        type: threshold.type,
        unlockedAt: "",  // to be assigned at persist time
        habitId: "",     // to be assigned by caller
      });
    }
  }

  return newlyUnlocked;
}

// =============================================================================
// ── getMilestoneDetails ──────────────────────────────────────────────────────
// =============================================================================

/** Display metadata returned by `getMilestoneDetails`. */
interface MilestoneDetails {
  /** Human-readable label (e.g. "7-Day Streak") */
  label: string;
  /** Emoji icon for the milestone */
  emoji: string;
  /** Description of the reward earned (e.g. "Streak freeze unlock") */
  reward: string;
}

/**
 * Returns the display information for a milestone given its `type` string.
 *
 * If the type is unrecognised (e.g. from a future app version), a sensible
 * fallback is returned so the UI never crashes.
 *
 * @param type - Machine-readable milestone type (e.g. "streak_7", "century").
 * @returns An object with `label`, `emoji`, and `reward`.
 */
export function getMilestoneDetails(type: string): MilestoneDetails {
  const match = MILESTONE_THRESHOLDS.find((t) => t.type === type);

  if (match) {
    return {
      label: match.label,
      emoji: match.emoji,
      reward: match.reward,
    };
  }

  // Fallback for unknown types — keep the UI safe
  return {
    label: type,
    emoji: "🏅",
    reward: "Achievement unlocked",
  };
}
