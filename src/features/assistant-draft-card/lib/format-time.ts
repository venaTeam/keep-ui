/** The local time of day, or null when there is no such date. */
export function formatTime(date: string | null | undefined): string | null {
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
}
