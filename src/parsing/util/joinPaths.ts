/**
 * Joins a URL prefix with a route path, handling slashes correctly.
 *
 * Examples:
 *   joinPaths('/tasks', '/')      → /tasks
 *   joinPaths('/tasks', '/:id')   → /tasks/:id
 *   joinPaths('/', '/foo')        → /foo
 *   joinPaths('/', '/')           → /
 */
export function joinPaths(prefix: string, routePath: string): string {
  // Normalize both parts
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const right = routePath === '/' ? '' : routePath.startsWith('/') ? routePath : '/' + routePath;

  const joined = left + right;

  return joined === ''
    ? '/'
    : joined;
}
