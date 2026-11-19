import { defineConfig,devices } from '@playwright/test'

export default defineConfig({
  testDir:'./tests',
  testMatch:'*.spec.ts',
  workers:1,
  timeout:45000,
  expect:{timeout:10000},
  reporter:[['list'],['junit',{outputFile:'.cache/verification/browser.xml'}]],
  use:{ ...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:37381', trace:'retain-on-failure' },
  webServer:[
    { command:'npm run build -- --outDir .cache/demo && npm run preview -- --outDir .cache/demo --host 127.0.0.1 --port 37381 --strictPort',
      url:'http://127.0.0.1:37381', env:{VITE_DATA_MODE:'demo',VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:''},reuseExistingServer:false },
    { command:'npm run build -- --outDir .cache/remote && npm run preview -- --outDir .cache/remote --host 127.0.0.1 --port 37382 --strictPort',
      url:'http://127.0.0.1:37382',env:{VITE_DATA_MODE:'supabase',VITE_SUPABASE_URL:'http://127.0.0.1:1',VITE_SUPABASE_ANON_KEY:'synthetic-placeholder'},reuseExistingServer:false },
  ],
})
