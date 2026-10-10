// Simple utility to merge class names (tailwind-merge-aware).
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
