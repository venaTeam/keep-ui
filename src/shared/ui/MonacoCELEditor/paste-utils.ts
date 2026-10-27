export function normalizeCelPaste(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ");
}
