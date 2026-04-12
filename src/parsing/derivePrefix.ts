import path from 'path';

/**
 * Derives the URL prefix from a route file's relative path.
 *
 * Examples:
 *   customers/index.route.ts   → /customers
 *   customers/groups.route.ts  → /customers/groups
 *   auth.route.ts              → /auth
 *   index.route.ts             → /
 *   api/v1/users/index.route.ts → /api/v1/users
 */
export function derivePrefix(relativePath: string): string {
  // Normalize separators to forward slashes
  let p = relativePath.split(path.sep).join('/');

  // Remove .route.ts extension
  p = p.replace(/\.route\.ts$/, '');

  // Remove /index or just index (if root-level)
  p = p.replace(/(\/index|^index)$/, '');

  // Ensure starts with /
  if (!p.startsWith('/')) {
    p = '/' + p;
  }

  // Empty string after stripping means root
  if (p === '/') {
    return '/';
  }

  return p;
}