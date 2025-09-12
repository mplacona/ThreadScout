import { APP_CONFIG } from '@/constants/app';
import { logger } from './logger';
import type { RecentSession } from '@/lib/api';

/**
 * Utility functions for localStorage operations
 */

/**
 * Safely reads recent sessions from localStorage
 */
export function getRecentSessionsFromStorage(): RecentSession[] {
  try {
    const stored = localStorage.getItem(APP_CONFIG.STORAGE.RECENT_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    logger.error('Error reading recent sessions from localStorage', error);
    return [];
  }
}

/**
 * Saves a single session to localStorage with error handling
 */
export function saveSessionToLocalStorage(sessionId: string, data: unknown): void {
  try {
    const key = `${APP_CONFIG.STORAGE.SESSION_KEY_PREFIX}${sessionId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logger.error(`Error saving session ${sessionId} to localStorage`, error);
  }
}

/**
 * Removes a session from localStorage
 */
export function removeSessionFromLocalStorage(sessionId: string): void {
  try {
    const key = `${APP_CONFIG.STORAGE.SESSION_KEY_PREFIX}${sessionId}`;
    localStorage.removeItem(key);
  } catch (error) {
    logger.error(`Error removing session ${sessionId} from localStorage`, error);
  }
}

/**
 * Updates the list of recent sessions in localStorage
 */
export function updateRecentSessions(sessions: RecentSession[]): void {
  try {
    const trimmed = sessions.slice(0, APP_CONFIG.STORAGE.MAX_RECENT_SESSIONS);
    localStorage.setItem(APP_CONFIG.STORAGE.RECENT_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    logger.error('Error updating recent sessions in localStorage', error);
  }
}

/**
 * Removes a specific session from the recent sessions list and clears its data
 */
export function deleteRecentSession(sessionId: string): void {
  try {
    // Remove from recent sessions list
    const existing = getRecentSessionsFromStorage();
    const filtered = existing.filter(s => s.sessionId !== sessionId);
    updateRecentSessions(filtered);
    
    // Remove the session data
    removeSessionFromLocalStorage(sessionId);
  } catch (error) {
    logger.error(`Error deleting session ${sessionId} from localStorage`, error);
  }
}

/**
 * Safely copies text to clipboard
 */
export async function copyToClipboard(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.error(`Failed to copy ${label} to clipboard`, error);
    return false;
  }
}