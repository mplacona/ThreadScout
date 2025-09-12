import { APP_CONFIG } from '@/constants/app';

/**
 * Formats a timestamp to show time ago (e.g., "2h ago", "3d ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const hoursAgo = Math.floor((Date.now() - timestamp) / APP_CONFIG.TIME.MILLISECONDS_PER_HOUR);
  
  if (hoursAgo < 1) return 'Just now';
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  
  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo}d ago`;
}

/**
 * Formats thread creation time from UTC timestamp
 */
export function formatThreadTimeAgo(createdUtc: number): string {
  const hoursAgo = Math.floor((Date.now() / 1000 - createdUtc) / 3600);
  
  if (hoursAgo < 1) return 'Just now';
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  
  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo}d ago`;
}