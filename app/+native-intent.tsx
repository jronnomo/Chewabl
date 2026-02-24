export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // On initial launch without a specific deep link, go to root
  if (initial && path === '/') return '/';
  // Pass through any incoming deep link path as-is
  return path;
}
