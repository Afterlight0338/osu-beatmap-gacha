/**
 * Localized User Time Formatting Utilities
 * Automatically detects the user's browser local timezone and formats dates/times accordingly.
 */

/**
 * Returns formatted UTC offset string (e.g. "UTC+8", "UTC-5", "UTC+0")
 */
export function getUserUtcOffset(): string {
  try {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const mins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    return mins > 0 ? `UTC${sign}${hours}:${mins.toString().padStart(2, '0')}` : `UTC${sign}${hours}`;
  } catch {
    return 'UTC';
  }
}

/**
 * Formats full Date & Time in the user's local timezone (e.g. "Aug 26, 2026, 03:18 PM")
 */
export function formatUserDateTime(
  timestampOrDate: number | string | Date | null | undefined,
  includeOffset = false
): string {
  if (!timestampOrDate) return '-';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '-';

  const formatted = d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return includeOffset ? `${formatted} (${getUserUtcOffset()})` : formatted;
}

/**
 * Formats Short Date & Time (e.g. "Aug 26, 03:18 PM")
 */
export function formatUserShortDateTime(
  timestampOrDate: number | string | Date | null | undefined
): string {
  if (!timestampOrDate) return '-';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats Date only in the user's local timezone (e.g. "Aug 26, 2026")
 */
export function formatUserDate(
  timestampOrDate: number | string | Date | null | undefined
): string {
  if (!timestampOrDate) return '-';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats Time only in user's local timezone (e.g. "03:18:20 PM")
 */
export function formatUserTime(
  timestampOrDate: number | string | Date | null | undefined
): string {
  if (!timestampOrDate) return '-';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Formats relative time (e.g. "Just now", "5m ago", "2h ago", "3d ago")
 */
export function formatRelativeTime(
  timestampOrDate: number | string | Date | null | undefined
): string {
  if (!timestampOrDate) return '-';
  const d = new Date(timestampOrDate);
  if (isNaN(d.getTime())) return '-';

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  return formatUserDate(d);
}
