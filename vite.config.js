import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // Dev-only: load ./config.mjs (git-ignored) to point the Escapp client at a
  // preview escape room while running `npm run dev`. In production the Escapp
  // server injects window.ESCAPP_APP_SETTINGS itself, so this never runs.
  let devSettings = null;
  const configPath = resolve(process.cwd(), 'config.mjs');
  if (mode === 'development' && existsSync(configPath)) {
    try {
      const mod = await import(pathToFileURL(configPath).href);
      devSettings = mod.ESCAPP_APP_SETTINGS || null;
    } catch (e) {
      console.warn('vite: could not load config.mjs —', e.message);
    }
  }

  // Inject window.ESCAPP_APP_SETTINGS into index.html exactly like the Escapp
  // server does in production, so the Escapp client reads the dev endpoint.
  const escappDevSettings = {
    name: 'escapp-dev-settings',
    transformIndexHtml() {
      if (!devSettings) return;
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.ESCAPP_APP_SETTINGS = ${JSON.stringify(devSettings)};`,
        },
      ];
    },
  };

  return {
    plugins: [react(), escappDevSettings],
    // Default to a relative base so the app works when served/embedded by Escapp.
    // GitHub Pages builds set VITE_BASE_PATH (e.g. "/ECHO/") so assets and routing
    // resolve under the project subpath.
    base: process.env.VITE_BASE_PATH || './',
  };
});
