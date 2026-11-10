import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({root:path.resolve('apps/web'),base:'/bruce-control/',plugins:[react(),tailwind()],build:{outDir:'dist',emptyOutDir:true},server:{port:5173}});
