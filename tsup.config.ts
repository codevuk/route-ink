import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [],
  onSuccess: async () => {
    // Copy template files to dist
    const srcTemplates = 'src/generation/templates';
    const distTemplates = 'dist/templates';

    if (existsSync(srcTemplates)) {
      mkdirSync(distTemplates, { recursive: true });
      const files = readdirSync(srcTemplates);

      for (const file of files) {
        copyFileSync(
          join(srcTemplates, file),
          join(distTemplates, file)
        );
      }

      console.log('✓ Copied template files to dist');
    }
  },
});
