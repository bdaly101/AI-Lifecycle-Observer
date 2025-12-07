import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli/index.ts',
    'src/hooks/wrapper.ts',
    'src/integrations/index.ts',
    'src/integrations/ai-pr-dev.ts',
    'src/integrations/ai-feature-builder.ts',
    'src/integrations/ai-test-generator.ts',
    'src/integrations/ai-docs-generator.ts',
    'src/integrations/ai-sql-dev.ts',
    'src/integrations/verify.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  external: ['better-sqlite3'],
});

