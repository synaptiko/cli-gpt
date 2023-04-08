import { build, stop } from 'https://deno.land/x/esbuild@v0.17.15/mod.js';
import denoJson from './deno.json' assert { type: 'json' };

await build({
  bundle: true,
  format: 'esm',
  platform: 'node',
  entryPoints: ['src/index.ts'],
  outfile: 'out/cli-gpt',
  banner: {
    js: '#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --allow-write --allow-run --unstable',
  },
  alias: Object.fromEntries(
    Object.entries(denoJson.imports).map(([key, value]) => [key.slice(0, -1), value.slice(0, -1)]),
  ),
});

stop();
