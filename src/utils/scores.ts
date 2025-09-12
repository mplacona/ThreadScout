import { APP_CONFIG, SCORE_HINTS } from '@/constants/app';

export type BadgeVariant = 'default' | 'secondary' | 'outline';

/**
 * Determines the appropriate badge variant based on thread score
 */
export function getScoreBadgeVariant(score: number): BadgeVariant {
  if (score >= APP_CONFIG.SCORES.EXCELLENT_THRESHOLD) return 'default'; // green
  if (score >= APP_CONFIG.SCORES.GOOD_THRESHOLD) return 'secondary'; // yellow
  return 'outline'; // red
}

/**
 * Generates a descriptive hint based on thread score
 */
export function generateScoreHint(score: number): string {
  if (score >= 80) return SCORE_HINTS.EXCELLENT;
  if (score >= 60) return SCORE_HINTS.GOOD;
  if (score >= APP_CONFIG.SCORES.MODERATE_THRESHOLD) return SCORE_HINTS.MODERATE;
  return SCORE_HINTS.LOW;
}