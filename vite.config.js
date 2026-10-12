import { defineConfig } from 'vite';
export default defineConfig(({command})=>({base:process.env.FOLIO_BASE_PATH || '/',publicDir:command==='build'?false:'public',build:{target:'es2022'},server:{port:5173,strictPort:true}}));
