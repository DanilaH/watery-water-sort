import {defineConfig} from '@playwright/test';
/** Startup order differs from the dev server: extracted CSS precedes module evaluation. */
export default defineConfig({
 testDir:'tests/browser',testMatch:'**/startup46.spec.ts',
 use:{baseURL:'http://127.0.0.1:4176',headless:true},
 webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4176 --strictPort',url:'http://127.0.0.1:4176',reuseExistingServer:false},
 reporter:'list'
});
