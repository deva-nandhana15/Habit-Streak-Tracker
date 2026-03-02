// =============================================================================
// HabitTracker — Firestore Service
// =============================================================================
// CRUD helpers for Users, Habits, Completions, and Milestones.
//
// Every function is fully typed, wraps its work in try/catch, and throws
// a descriptive error message on failure.
//
// Firestore timestamps are converted to ISO-8601 strings on read so that
// consuming code never has to deal with Firestore's Timestamp class directly.
//
// Firestore collection layout:
//   users/{uid}                          → user profile
//   users/{uid}/habits/{habitId}         → habits
//   users/{uid}/completions/{id}         → completions (all habits combined)
//   users/{uid}/milestones/{id}          → earned milestones
// =============================================================================

import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./config";
import type { User, Habit, Completion, Milestone, Frequency } from "../types";

// =============================================================================
// ── Helpers ──────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Converts any Firestore `Timestamp` values in a document snapshot to
 * ISO-8601 strings, so the rest of the app works with plain JS types.
 *
 * Handles nested objects one level deep (sufficient for our flat schemas).
 */
function convertTimestamps(data: DocumentData): DocumentData {
  const converted: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate().toISOString();
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

/**
 * Returns the start-of-day and end-of-day Date objects for "today" in the
 * device's local timezone. Used by `getTodayCompletion` to scope its query.
 */
function getTodayRange(): { startOfDay: string; endOfDay: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23, 59, 59, 999
  );
  return {
    startOfDay: start.toISOString(),
    endOfDay: end.toISOString(),
  };
}

// =============================================================================
// ── Users ────────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Creates (or overwrites) a user profile document at `users/{uid}`.
 *
 * @param uid  - Firebase Auth UID used as the document ID.
 * @param data - Profile fields to store (everything except `uid`, which is
 *               derived from the first argument).
 * @throws Descriptive error on Firestore failure.
 */
export async function createUserProfile(
  uid: string,
  data: Omit<User, "uid">
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      uid,
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to create user profile: ${msg}`);
  }
}

/**
 * Fetches a user profile by UID.
 * Firestore Timestamps are converted to ISO-8601 strings automatically.
 *
 * @param uid - Firebase Auth UID.
 * @returns The User object, or `null` if the document does not exist.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const userRef = doc(db, "users", uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) return null;
    return { uid, ...convertTimestamps(snapshot.data()) } as User;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch user profile: ${msg}`);
  }
}

// =============================================================================
// ── Habits ───────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Payload for creating a new habit.
 * `id`, `createdAt`, `currentStreak`, and `bestStreak` are set automatically.
 * Includes optional `customDays` for "custom" frequency support.
 */
interface AddHabitPayload {
  name: string;
  icon: string;
  category: string;
  frequency: Frequency;
  /** Required when frequency is "custom": array of day indices 0-6 (Sun-Sat) */
  customDays?: number[];
  reminderTime: string | null;
}

/**
 * Adds a new habit under `users/{uid}/habits`.
 *
 * When `frequency` is `"custom"`, the caller **must** supply `customDays` — an
 * array of JS day indices (0 = Sun … 6 = Sat). The function validates this
 * constraint and throws if it is violated.
 *
 * @param uid   - Owning user's UID.
 * @param habit - Habit fields supplied by the UI.
 * @returns The Firestore-generated document ID.
 */
export async function addHabit(
  uid: string,
  habit: AddHabitPayload
): Promise<string> {
  try {
    // Validate customDays when frequency is "custom"
    if (habit.frequency === "custom") {
      if (!habit.customDays || habit.customDays.length === 0) {
        throw new Error(
          'customDays must be a non-empty array when frequency is "custom".'
        );
      }
      const allValid = habit.customDays.every((d) => d >= 0 && d <= 6);
      if (!allValid) {
        throw new Error(
          "Each value in customDays must be between 0 (Sunday) and 6 (Saturday)."
        );
      }
    }

    const habitsCol = collection(db, "users", uid, "habits");

    // Build the document data — auto-set server-managed fields
    const habitData: Record<string, unknown> = {
      name: habit.name,
      icon: habit.icon,
      category: habit.category,
      frequency: habit.frequency,
      reminderTime: habit.reminderTime,
      createdAt: new Date().toISOString(),
      currentStreak: 0,
      bestStreak: 0,
    };

    // Only persist customDays for "custom" frequency
    if (habit.frequency === "custom" && habit.customDays) {
      habitData.customDays = habit.customDays;
    }

    const docRef = await addDoc(habitsCol, habitData);
    return docRef.id;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to add habit: ${msg}`);
  }
}

/**
 * Fetches all habits for a user, ordered by creation date (newest first).
 * Firestore Timestamps are converted to ISO-8601 strings automatically.
 *
 * @param uid - Owning user's UID.
 * @returns Array of Habit objects (each includes the Firestore doc ID).
 */
export async function getUserHabits(uid: string): Promise<Habit[]> {
  try {
    const habitsCol = collection(db, "users", uid, "habits");
    const q = query(habitsCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as Habit[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch habits: ${msg}`);
  }
}

/**
 * Payload accepted by `updateHabit`. Every field is optional.
 * Includes optional `customDays` for "custom" frequency support.
 */
interface UpdateHabitPayload {
  name?: string;
  icon?: string;
  category?: string;
  frequency?: Frequency;
  /** Required when switching frequency to "custom" */
  customDays?: number[];
  reminderTime?: string | null;
  currentStreak?: number;
  bestStreak?: number;
}

/**
 * Partially updates an existing habit document.
 * Validates `customDays` whenever frequency is set to `"custom"`.
 *
 * @param uid     - Owning user's UID.
 * @param habitId - Document ID of the habit.
 * @param data    - Fields to merge.
 */
export async function updateHabit(
  uid: string,
  habitId: string,
  data: UpdateHabitPayload
): Promise<void> {
  try {
    // Validate customDays when frequency is being set to "custom"
    if (data.frequency === "custom") {
      if (!data.customDays || data.customDays.length === 0) {
        throw new Error(
          'customDays must be a non-empty array when frequency is "custom".'
        );
      }
      const allValid = data.customDays.every((d) => d >= 0 && d <= 6);
      if (!allValid) {
        throw new Error(
          "Each value in customDays must be between 0 (Sunday) and 6 (Saturday)."
        );
      }
    }

    const habitRef = doc(db, "users", uid, "habits", habitId);
    await updateDoc(habitRef, { ...data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to update habit: ${msg}`);
  }
}

/**
 * Deletes a habit **and** all of its completions from the flat
 * `users/{uid}/completions` collection.
 *
 * Firestore does not cascade deletes, so we query for every completion
 * matching the habitId and remove them in sequence before deleting the
 * habit document itself.
 *
 * @param uid     - Owning user's UID.
 * @param habitId - Document ID of the habit to remove.
 */
export async function deleteHabit(
  uid: string,
  habitId: string
): Promise<void> {
  try {
    // Step 1 — delete all completions that belong to this habit
    const completionsCol = collection(db, "users", uid, "completions");
    const completionsQuery = query(
      completionsCol,
      where("habitId", "==", habitId)
    );
    const completionSnap = await getDocs(completionsQuery);

    const deletePromises: Promise<void>[] = completionSnap.docs.map((d) =>
      deleteDoc(d.ref)
    );
    await Promise.all(deletePromises);

    // Step 2 — delete the habit document itself
    const habitRef = doc(db, "users", uid, "habits", habitId);
    await deleteDoc(habitRef);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to delete habit: ${msg}`);
  }
}

// =============================================================================
// ── Completions ──────────────────────────────────────────────────────────────
// =============================================================================
// Completions live in a flat sub-collection: users/{uid}/completions/{id}
// Each document carries a `habitId` field so we can filter per-habit.
// =============================================================================

/** Payload for recording a habit completion. */
interface AddCompletionPayload {
  habitId: string;
  note?: string;
}

/**
 * Records a completion event for a habit.
 *
 * @param uid        - Owning user's UID.
 * @param completion - Must include `habitId`; `note` is optional.
 * @returns The Firestore-generated completion document ID.
 */
export async function addCompletion(
  uid: string,
  completion: AddCompletionPayload
): Promise<string> {
  try {
    const completionsCol = collection(db, "users", uid, "completions");

    const completionData: Record<string, unknown> = {
      habitId: completion.habitId,
      completedAt: new Date().toISOString(),
    };

    if (completion.note) {
      completionData.note = completion.note;
    }

    const docRef = await addDoc(completionsCol, completionData);
    return docRef.id;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to add completion: ${msg}`);
  }
}

/**
 * Fetches all completions for a specific habit, ordered newest-first.
 * Firestore Timestamps are converted to ISO-8601 strings automatically.
 *
 * @param uid     - Owning user's UID.
 * @param habitId - The habit whose completions to retrieve.
 * @returns Array of Completion objects.
 */
export async function getCompletions(
  uid: string,
  habitId: string
): Promise<Completion[]> {
  try {
    const completionsCol = collection(db, "users", uid, "completions");
    const q = query(
      completionsCol,
      where("habitId", "==", habitId),
      orderBy("completedAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as Completion[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch completions: ${msg}`);
  }
}

/**
 * Returns the completion record for a given habit **if it was completed
 * today** (device-local midnight → 23:59:59.999). Returns `null` otherwise.
 *
 * This is the primary check used by the UI to decide whether to show a
 * habit as "done" for the current day.
 *
 * @param uid     - Owning user's UID.
 * @param habitId - The habit to check.
 * @returns The today's Completion, or `null` if not yet completed.
 */
export async function getTodayCompletion(
  uid: string,
  habitId: string
): Promise<Completion | null> {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const completionsCol = collection(db, "users", uid, "completions");
    const q = query(
      completionsCol,
      where("habitId", "==", habitId),
      where("completedAt", ">=", startOfDay),
      where("completedAt", "<=", endOfDay)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    // Return the first (and ideally only) completion for today
    const d = snapshot.docs[0];
    return {
      id: d.id,
      ...convertTimestamps(d.data()),
    } as Completion;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch today's completion: ${msg}`);
  }
}

// =============================================================================
// ── Milestones ───────────────────────────────────────────────────────────────
// =============================================================================

/** Payload for unlocking a new milestone. */
interface AddMilestonePayload {
  type: string;
  habitId: string;
}

/**
 * Records a newly unlocked milestone for a user.
 *
 * @param uid       - Owning user's UID.
 * @param milestone - Milestone type identifier and the triggering habit ID.
 * @returns The Firestore-generated milestone document ID.
 */
export async function addMilestone(
  uid: string,
  milestone: AddMilestonePayload
): Promise<string> {
  try {
    const milestonesCol = collection(db, "users", uid, "milestones");

    const milestoneData: Record<string, unknown> = {
      type: milestone.type,
      habitId: milestone.habitId,
      unlockedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(milestonesCol, milestoneData);
    return docRef.id;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to add milestone: ${msg}`);
  }
}

/**
 * Fetches all milestones for a user, ordered by unlock date (newest first).
 * Firestore Timestamps are converted to ISO-8601 strings automatically.
 *
 * @param uid - Owning user's UID.
 * @returns Array of Milestone objects.
 */
export async function getUserMilestones(uid: string): Promise<Milestone[]> {
  try {
    const milestonesCol = collection(db, "users", uid, "milestones");
    const q = query(milestonesCol, orderBy("unlockedAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as Milestone[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch milestones: ${msg}`);
  }
}
