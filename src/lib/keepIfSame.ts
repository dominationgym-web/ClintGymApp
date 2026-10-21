// Keep the row already on screen when a reload brings back the same data.
// The profile reloads every time the app comes back to the front (after a
// photo picker, a permission box, the notification shade), and a new object
// made every open trainer screen reload all its data at once.
export function keepIfSame<T>(current: T | null, next: T | null): T | null {
  if (current === next) return current;
  if (current && next && JSON.stringify(current) === JSON.stringify(next)) return current;
  return next;
}
