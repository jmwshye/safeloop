import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.GITHUB_PAGES === 'true' ? '/safeloop/' : '/',
});
