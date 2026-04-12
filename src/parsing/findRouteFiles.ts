import fs from 'fs';
import path from 'path';

export function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  function scan(currentDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.route.ts')) {
        results.push(fullPath);
      }
    }
  }

  scan(dir);
  return results;
}