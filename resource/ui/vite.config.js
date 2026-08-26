import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'path';

const currentDirectory = process.cwd();

function preserveGeneratedDirectoryMarker() {
	return {
		name: 'preserve-generated-directory-marker',
		closeBundle() {
			fs.writeFileSync(path.resolve(currentDirectory, '../html/.gitkeep'), '');
		},
	};
}

// https://vite.dev/config/
export default defineConfig({
	server: {
		port: 5171,
	},
	plugins: [svelte(), preserveGeneratedDirectoryMarker()],
    base: './',
	build: {
		rollupOptions: {
			output: {
				format: 'es',
				inlineDynamicImports: true,
				entryFileNames: `script.js`,
				assetFileNames: ({name}) => {
					if((/\.css$/).test(name ?? '')) {
                        return `index.css`;
                    }
					return `assets/media/[name][extname]`;
				},
			},
		},
		chunkSizeWarningLimit: 9999,
		outDir: '../html',
		emptyOutDir: true,
		minify: true,
	},
	resolve: {
        alias: {
            '@': path.resolve(currentDirectory, './src'),
            '@css': path.resolve(currentDirectory, './src/css'),
            '@js': path.resolve(currentDirectory, './src/js'),
            '@c': path.resolve(currentDirectory, './src/lib')
        }
    }
});
