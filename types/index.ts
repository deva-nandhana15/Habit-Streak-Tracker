// =============================================================================
// HabitTracker — Core TypeScript Type Definitions
// =============================================================================
// All shared types used across the application. Strict mode compatible.
// =============================================================================

/**
 * Frequency at which a habit should be performed.
 * - "daily"   → every day
 * - "weekly"  → once per week
 * - "monthly" → once per month
 * - "custom"  → user-selected days of the week        // ← CHANGED: added "custom"
 */
export type Frequency = "daily" | "weekly" | "monthly" | "custom";  // ← CHANGED: added "custom"

// -----------------------------------------------------------------------------
// User
// -----------------------------------------------------------------------------
/** Represents an authenticated user stored in Firestore. */
export interface User {
  /** Firebase Auth UID — primary key */
  uid: string;

  /** User's email address (from Firebase Auth) */
  email: string;

  /** Optional phone number linked to the account */
  phone: string;

  /** Display name shown in the UI */
  displayName: string;

  /** ISO-8601 timestamp of account creation */
  createdAt: string;

  /** Cumulative gamification points earned across all habits */
  totalPoints: number;

  /**
   * Number of streak-freeze tokens the user currently holds.
   * A streak freeze prevents a streak from resetting when a day is missed.
   */
  streakFreezes: number;
}

// -----------------------------------------------------------------------------
// Habit
// -----------------------------------------------------------------------------
/** A single trackable habit belonging to a user. */
export interface Habit {
  /** Firestore document ID */
  id: string;

  /** Human-readable habit name (e.g. "Drink 2L Water") */
  name: string;

  /** Single emoji used as the habit icon (e.g. "💧") */
  icon: string;

  /** Grouping category (e.g. "Health", "Fitness", "Mindfulness") */
  category: string;

  /** How often the habit should be completed */
  frequency: Frequency;

  // ← CHANGED: added customDays for "custom" frequency
  /**
   * Active days of the week when frequency is "custom".
   * Array of JS day indices: 0 = Sunday … 6 = Saturday.
   * Required when `frequency` is "custom"; ignored otherwise.
   *
   * Calendar-grid rules (to be built later):
   *   • Days NOT in customDays show "—" (skipped, not missed)
   *   • Only days IN customDays count toward the streak
   *   • Missing a required custom day breaks the streak
   *   • Completing on a required day increments the streak
   */
  customDays?: number[];

  /**
   * Optional reminder time in HH:mm (24-hour) format.
   * `null` means no reminder is set.
   */
  reminderTime: string | null;

  /** ISO-8601 timestamp of when the habit was created */
  createdAt: string;

  /** Number of consecutive completions in the current streak */
  currentStreak: number;

  /** Highest streak ever achieved for this habit */
  bestStreak: number;
}

// -----------------------------------------------------------------------------
// Completion
// -----------------------------------------------------------------------------
/** Records a single completion event for a habit. */
export interface Completion {
  /** Firestore document ID */
  id: string;

  /** ID of the parent Habit this completion belongs to */
  habitId: string;

  /** ISO-8601 timestamp of when the habit was marked complete */
  completedAt: string;

  /** Optional user-provided note about this completion */
  note?: string;
}

// -----------------------------------------------------------------------------
// Milestone
// -----------------------------------------------------------------------------
/**
 * A milestone / achievement unlocked by the user.
 * Examples: "7-day streak", "30-day streak", "100 completions".
 */
export interface Milestone {
  /** Firestore document ID */
  id: string;

  /**
   * Machine-readable milestone type identifier.
   * Convention: "<metric>_<threshold>" e.g. "streak_7", "streak_30", "completions_100"
   */
  type: string;

  /** ISO-8601 timestamp of when the milestone was unlocked */
  unlockedAt: string;

  /** ID of the habit that triggered this milestone */
  habitId: string;
}
