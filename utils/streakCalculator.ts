// =============================================================================
// HabitTracker — Streak Calculator
// =============================================================================
// Pure utility functions for computing streaks, detecting risk, and identifying
// skipped (non-required) dates.  All date logic uses date-fns.
//
// Frequency semantics:
//   "daily"   → every calendar day is required
//   "weekly"  → at least one completion per ISO week (Mon-Sun)
//   "monthly" → at least one completion per calendar month
//   "custom"  → only the days listed in customDays[] are required
//               (0 = Sun, 1 = Mon … 6 = Sat)
// =============================================================================

import {
  parseISO,
  startOfDay,
  isToday,
  isSameDay,
  isSameWeek,
  isSameMonth,
  subDays,
  getDay,
  getHours,
  isLastDayOfMonth,
  isSunday,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isAfter,
  isBefore,
  isEqual,
} from "date-fns";
import type { Completion, Frequency } from "../types";

// =============================================================================
// ── Helpers (internal) ───────────────────────────────────────────────────────
// =============================================================================

/**
 * Parses the `completedAt` ISO string from a Completion and drops the time
 * portion so comparisons are day-level only.
 */
function completionDate(c: Completion): Date {
  return startOfDay(parseISO(c.completedAt));
}

/**
 * Returns a *descending* sorted list of **unique completion days**.
 * Multiple completions on the same day are collapsed into one entry.
 */
function uniqueSortedDays(completions: Completion[]): Date[] {
  // Build a Set keyed on "YYYY-MM-DD" to deduplicate
  const seen = new Set<string>();
  const days: Date[] = [];

  for (const c of completions) {
    const d = completionDate(c);
    const key = d.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      days.push(d);
    }
  }

  // Sort descending (most recent first)
  days.sort((a, b) => b.getTime() - a.getTime());
  return days;
}

/**
 * Returns `true` if `date` (day-of-week) is a required day for the given
 * frequency and optional customDays array.
 */
function isRequiredDay(
  date: Date,
  frequency: Frequency,
  customDays?: number[]
): boolean {
  switch (frequency) {
    case "daily":
      // Every day is required
      return true;

    case "custom":
      // Only days whose weekday index appears in customDays are required
      return customDays ? customDays.includes(getDay(date)) : false;

    case "weekly":
      // Any day of the week is valid — we only enforce "at least one per week"
      return true;

    case "monthly":
      // Any day of the month is valid — we only enforce "at least one per month"
      return true;

    default:
      return true;
  }
}

/**
 * Checks whether any completion falls within the same ISO week as `date`.
 */
function hasCompletionInWeek(days: Date[], date: Date): boolean {
  return days.some((d) => isSameWeek(d, date, { weekStartsOn: 1 }));
}

/**
 * Checks whether any completion falls within the same calendar month as `date`.
 */
function hasCompletionInMonth(days: Date[], date: Date): boolean {
  return days.some((d) => isSameMonth(d, date));
}

// =============================================================================
// ── calculateStreak ──────────────────────────────────────────────────────────
// =============================================================================

/**
 * Calculates the **current streak** — the number of consecutive required
 * periods (days / weeks / months) going backwards from today that have at
 * least one completion.
 *
 * Rules by frequency:
 *   "daily"   — every calendar day must have a completion
 *   "weekly"  — every ISO week must have at least one completion
 *   "monthly" — every calendar month must have at least one completion
 *   "custom"  — every day-of-week in customDays[] must be completed;
 *               non-required days are silently skipped
 *
 * @returns The current streak count (0 when there are no completions).
 */
export function calculateStreak(
  completions: Completion[],
  frequency: Frequency,
  customDays?: number[]
): number {
  if (completions.length === 0) return 0;

  const days = uniqueSortedDays(completions);
  const today = startOfDay(new Date());

  switch (frequency) {
    // ─── Daily ───────────────────────────────────────────────────────────
    case "daily": {
      let streak = 0;
      let cursor = today;

      // If today hasn't been completed yet, start checking from yesterday
      // (the streak isn't broken *yet* — it's only at risk)
      if (!days.some((d) => isSameDay(d, today))) {
        cursor = subDays(today, 1);
      }

      while (true) {
        if (days.some((d) => isSameDay(d, cursor))) {
          streak++;
          cursor = subDays(cursor, 1);
        } else {
          break; // streak broken
        }
      }

      return streak;
    }

    // ─── Custom ──────────────────────────────────────────────────────────
    case "custom": {
      if (!customDays || customDays.length === 0) return 0;

      let streak = 0;
      let cursor = today;

      // If today is a required day but not yet completed, start from yesterday
      if (
        customDays.includes(getDay(today)) &&
        !days.some((d) => isSameDay(d, today))
      ) {
        cursor = subDays(today, 1);
      }

      // Walk backwards day by day
      // We go back a reasonable maximum (e.g. 1 year = 366 days) to avoid infinite loops
      const maxLookback = 366;
      let looked = 0;

      while (looked < maxLookback) {
        if (customDays.includes(getDay(cursor))) {
          // This was a required day — check if it was completed
          if (days.some((d) => isSameDay(d, cursor))) {
            streak++;
          } else {
            break; // missed a required day → streak broken
          }
        }
        // Non-required days are simply skipped (don't break or add to streak)
        cursor = subDays(cursor, 1);
        looked++;
      }

      return streak;
    }

    // ─── Weekly ──────────────────────────────────────────────────────────
    case "weekly": {
      let streak = 0;
      let cursor = today;

      // If no completion this week yet, start checking from previous week
      if (!hasCompletionInWeek(days, today)) {
        cursor = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
      }

      const maxWeeks = 53;
      let weeksChecked = 0;

      while (weeksChecked < maxWeeks) {
        if (hasCompletionInWeek(days, cursor)) {
          streak++;
          // Jump to the previous week
          cursor = subDays(startOfWeek(cursor, { weekStartsOn: 1 }), 1);
          weeksChecked++;
        } else {
          break;
        }
      }

      return streak;
    }

    // ─── Monthly ─────────────────────────────────────────────────────────
    case "monthly": {
      let streak = 0;
      let cursor = today;

      // If no completion this month yet, start checking from previous month
      if (!hasCompletionInMonth(days, today)) {
        cursor = subDays(startOfMonth(today), 1);
      }

      const maxMonths = 13;
      let monthsChecked = 0;

      while (monthsChecked < maxMonths) {
        if (hasCompletionInMonth(days, cursor)) {
          streak++;
          // Jump to the previous month
          cursor = subDays(startOfMonth(cursor), 1);
          monthsChecked++;
        } else {
          break;
        }
      }

      return streak;
    }
  }
}

// =============================================================================
// ── getBestStreak ────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Scans the **entire** completion history and returns the longest consecutive
 * streak ever achieved, using the same per-frequency rules as `calculateStreak`.
 *
 * @returns The highest streak count (0 when there are no completions).
 */
export function getBestStreak(
  completions: Completion[],
  frequency: Frequency,
  customDays?: number[]
): number {
  if (completions.length === 0) return 0;

  const days = uniqueSortedDays(completions);
  // We need ascending order to walk forward through history
  const ascending = [...days].reverse();

  switch (frequency) {
    // ─── Daily ───────────────────────────────────────────────────────────
    case "daily": {
      let best = 1;
      let current = 1;

      for (let i = 1; i < ascending.length; i++) {
        const prev = ascending[i - 1];
        const curr = ascending[i];
        // Check if this day is exactly 1 day after the previous
        if (isSameDay(curr, subDays(prev, -1))) {
          current++;
          best = Math.max(best, current);
        } else {
          current = 1;
        }
      }

      return best;
    }

    // ─── Custom ──────────────────────────────────────────────────────────
    case "custom": {
      if (!customDays || customDays.length === 0) return 0;

      // Build the full range of days from first to last completion
      const firstDay = ascending[0];
      const lastDay = ascending[ascending.length - 1];
      const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });

      // Filter to only required days
      const requiredDays = allDays.filter((d) =>
        customDays.includes(getDay(d))
      );
      if (requiredDays.length === 0) return 0;

      let best = 0;
      let current = 0;

      for (const reqDay of requiredDays) {
        if (ascending.some((d) => isSameDay(d, reqDay))) {
          current++;
          best = Math.max(best, current);
        } else {
          current = 0; // missed a required day → streak resets
        }
      }

      return best;
    }

    // ─── Weekly ──────────────────────────────────────────────────────────
    case "weekly": {
      // Group completions by ISO week — just track which weeks had completions
      const weekKeys = new Set<string>();
      for (const d of ascending) {
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        weekKeys.add(ws.toISOString());
      }

      // Sort week-start dates ascending
      const sortedWeeks = [...weekKeys]
        .map((k) => new Date(k))
        .sort((a, b) => a.getTime() - b.getTime());

      if (sortedWeeks.length === 0) return 0;

      let best = 1;
      let current = 1;

      for (let i = 1; i < sortedWeeks.length; i++) {
        const prevWeekEnd = endOfWeek(sortedWeeks[i - 1], { weekStartsOn: 1 });
        const nextExpectedWeekStart = startOfWeek(
          subDays(prevWeekEnd, -1),
          { weekStartsOn: 1 }
        );

        if (isSameDay(sortedWeeks[i], nextExpectedWeekStart)) {
          current++;
          best = Math.max(best, current);
        } else {
          current = 1;
        }
      }

      return best;
    }

    // ─── Monthly ─────────────────────────────────────────────────────────
    case "monthly": {
      // Track which months had completions (keyed by "YYYY-MM")
      const monthKeys = new Set<string>();
      for (const d of ascending) {
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        monthKeys.add(key);
      }

      const sortedMonths = [...monthKeys].sort();
      if (sortedMonths.length === 0) return 0;

      let best = 1;
      let current = 1;

      for (let i = 1; i < sortedMonths.length; i++) {
        const [prevY, prevM] = sortedMonths[i - 1].split("-").map(Number);
        const [currY, currM] = sortedMonths[i].split("-").map(Number);

        // Check if this month is exactly 1 month after the previous
        const expectedMonth = prevM + 1 > 11 ? 0 : prevM + 1;
        const expectedYear = prevM + 1 > 11 ? prevY + 1 : prevY;

        if (currY === expectedYear && currM === expectedMonth) {
          current++;
          best = Math.max(best, current);
        } else {
          current = 1;
        }
      }

      return best;
    }
  }
}

// =============================================================================
// ── isCompletedToday ─────────────────────────────────────────────────────────
// =============================================================================

/**
 * Returns `true` if there is at least one completion whose `completedAt`
 * falls on the current calendar day (device-local timezone).
 *
 * @returns `false` when the completions array is empty.
 */
export function isCompletedToday(completions: Completion[]): boolean {
  if (completions.length === 0) return false;
  return completions.some((c) => isToday(parseISO(c.completedAt)));
}

// =============================================================================
// ── isStreakAtRisk ────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Returns `true` when the streak is in danger of being lost:
 *   1. The habit is **required** today (per frequency / customDays).
 *   2. It has **not** been completed today.
 *   3. The current local time is **past 8 PM** (20:00).
 *
 * Frequency-specific nuances:
 *   "daily"   — at risk if today is incomplete and it's after 8 PM
 *   "custom"  — at risk only if today is in customDays[] and incomplete
 *   "weekly"  — at risk if it's Sunday, no completion this week, past 8 PM
 *   "monthly" — at risk if it's the last day of the month, no completion
 *               this month, past 8 PM
 */
export function isStreakAtRisk(
  completions: Completion[],
  frequency: Frequency,
  customDays?: number[]
): boolean {
  const now = new Date();
  const today = startOfDay(now);
  const isPast8PM = getHours(now) >= 20;

  // If it's not past 8 PM, never at risk
  if (!isPast8PM) return false;

  const days = uniqueSortedDays(completions);
  const completedToday = days.some((d) => isSameDay(d, today));

  switch (frequency) {
    case "daily":
      // Required every day — at risk if not completed today
      return !completedToday;

    case "custom":
      // Only at risk if today is a required day and not completed
      if (!customDays || !customDays.includes(getDay(today))) return false;
      return !completedToday;

    case "weekly":
      // At risk only on Sunday if nothing completed this week
      if (!isSunday(today)) return false;
      return !hasCompletionInWeek(days, today);

    case "monthly":
      // At risk only on the last day of the month if nothing completed this month
      if (!isLastDayOfMonth(today)) return false;
      return !hasCompletionInMonth(days, today);
  }
}

// =============================================================================
// ── shouldStreakReset ─────────────────────────────────────────────────────────
// =============================================================================

/**
 * Returns `true` if the streak should be considered **broken** — i.e. the user
 * missed a required completion window that has already elapsed.
 *
 * This checks **yesterday** (or the last required period) rather than today,
 * because today is still in progress.
 *
 * Frequency-specific logic:
 *   "daily"   — yesterday must have a completion
 *   "custom"  — the most recent past required day must have a completion
 *   "weekly"  — the previous ISO week must have at least one completion
 *   "monthly" — the previous calendar month must have one completion
 *
 * @returns `false` when there are no completions (nothing to reset).
 */
export function shouldStreakReset(
  completions: Completion[],
  frequency: Frequency,
  customDays?: number[]
): boolean {
  // No completions means no active streak to reset
  if (completions.length === 0) return false;

  const days = uniqueSortedDays(completions);
  const today = startOfDay(new Date());

  switch (frequency) {
    case "daily": {
      // Yesterday must have been completed
      const yesterday = subDays(today, 1);
      return !days.some((d) => isSameDay(d, yesterday));
    }

    case "custom": {
      if (!customDays || customDays.length === 0) return false;

      // Walk backwards from yesterday to find the most recent required day
      let cursor = subDays(today, 1);
      const maxLookback = 7; // a week is the maximum gap in a weekly cycle
      for (let i = 0; i < maxLookback; i++) {
        if (customDays.includes(getDay(cursor))) {
          // Found the last required day — was it completed?
          return !days.some((d) => isSameDay(d, cursor));
        }
        cursor = subDays(cursor, 1);
      }
      // No required day found in the last 7 days — no reset needed
      return false;
    }

    case "weekly": {
      // The previous ISO week must have at least one completion
      const prevWeekDay = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
      return !hasCompletionInWeek(days, prevWeekDay);
    }

    case "monthly": {
      // The previous calendar month must have at least one completion
      const prevMonthDay = subDays(startOfMonth(today), 1);
      return !hasCompletionInMonth(days, prevMonthDay);
    }
  }
}

// =============================================================================
// ── getSkippedDates ──────────────────────────────────────────────────────────
// =============================================================================

/**
 * Given a list of calendar dates (e.g. all days rendered in a calendar grid),
 * returns the subset that are **non-required** for the given frequency.
 *
 * These dates should display "—" in the UI instead of ✓ or ✗.
 *
 * Frequency-specific rules:
 *   "daily"   — every day is required → returns empty array
 *   "custom"  — days whose weekday is NOT in customDays[] are skipped
 *   "weekly"  — all days except one representative day per week (we pick
 *               the first day of the week as the representative; the rest
 *               are skipped)
 *   "monthly" — all days except the first day of each month are skipped
 *
 * @param dates      - The full set of dates to evaluate (e.g. month grid).
 * @param frequency  - The habit's frequency.
 * @param customDays - Required when frequency is "custom".
 * @returns Subset of `dates` that are non-required (should show "—").
 */
export function getSkippedDates(
  dates: Date[],
  frequency: Frequency,
  customDays?: number[]
): Date[] {
  switch (frequency) {
    case "daily":
      // Every day is required — nothing is skipped
      return [];

    case "custom": {
      if (!customDays || customDays.length === 0) return [...dates];
      // Return dates whose day-of-week is NOT in the customDays set
      return dates.filter((d) => !customDays.includes(getDay(d)));
    }

    case "weekly": {
      // Keep only the first day (weekStartsOn: 1 = Monday) of each week
      // as the "representative" required date; skip the rest
      const weekStarts = new Set<string>();
      return dates.filter((d) => {
        const ws = startOfWeek(d, { weekStartsOn: 1 }).toISOString();
        if (weekStarts.has(ws)) {
          return true; // not the representative → skipped
        }
        weekStarts.add(ws);
        return false; // this is the representative → NOT skipped
      });
    }

    case "monthly": {
      // Keep only the 1st of each month as the "representative"
      // All other days are skipped
      const monthStarts = new Set<string>();
      return dates.filter((d) => {
        const ms = startOfMonth(d).toISOString();
        if (monthStarts.has(ms)) {
          return true; // not the representative → skipped
        }
        monthStarts.add(ms);
        return false; // representative → NOT skipped
      });
    }
  }
}
