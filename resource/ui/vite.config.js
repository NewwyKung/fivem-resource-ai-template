import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
    server: {
        port: 5171,
    },
    plugins: [svelte()],
    base: './',
    build: {
        outDir: '../html',
        emptyOutDir: true,
        minify: true,
        chunkSizeWarningLimit: 9999,
        rollupOptions: {
            output: {
                format: 'es',
                inlineDynamicImports: true,
                entryFileNames: 'script.js',
                assetFileNames: ({ name }) => {
                    if (/\.css$/.test(name ?? '')) return 'index.css';
                    return 'assets/media/[name][extname]';
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@css': path.resolve(__dirname, './src/css'),
            '@js': path.resolve(__dirname, './src/js'),
            '@c': path.resolve(__dirname, './src/lib'),
        },
    },
});
