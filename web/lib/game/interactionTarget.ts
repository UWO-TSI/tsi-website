/** Ignore freshly allocated target records when their displayed/action values are unchanged. */
export function sameInteractionTarget<T extends object>(previous: T | null, next: T | null): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  const entries = Object.entries(previous);
  if (entries.length !== Object.keys(next).length) return false;
  return entries.every(([key, value]) => {
    const other = next[key as keyof T];
    return Array.isArray(value) && Array.isArray(other)
      ? value.length === other.length && value.every((item, index) => Object.is(item, other[index]))
      : Object.is(value, other);
  });
}
