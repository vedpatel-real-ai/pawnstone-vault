import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    {
      name: 'public-offline-assets',
      writeBundle(options, bundle) {
        const dir = options.dir ?? 'dist'
        const files = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).sort().map(name => '/' + name)
        const template = readFileSync('public/sw.js','utf8')
        const hash = createHash('sha256').update(template)
        for (const file of [...files,'/index.html','/favicon.svg','/placeholder.svg','/manifest.webmanifest']) {
          hash.update(readFileSync(path.join(dir,file)))
        }
        writeFileSync(path.join(dir,'sw.js'),template.replace('/* BUNDLE_FILES */[]',JSON.stringify(files)).replace('BUILD_HASH',hash.digest('hex').slice(0,16)))
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
