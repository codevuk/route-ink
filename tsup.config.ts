import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'tsup';

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  entry: ['src/index.ts', 'src/prisma-generator.ts', 'src/cube-sync-generator.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'node24',
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [],
  onSuccess: async () => {
    // Copy template files to dist
    const srcTemplates = 'src/generation/templates';
    const distTemplates = 'dist/templates';

    if (existsSync(srcTemplates)) {
      copyDir(srcTemplates, distTemplates);
      console.log('✓ Copied template files to dist');
    }
  },
});
