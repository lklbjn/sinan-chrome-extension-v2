import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import {resolve} from 'path';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'fs';
import {viteStaticCopy} from "vite-plugin-static-copy";

const syncManifest = () => {
    const manifestSrc = resolve(__dirname, 'src/manifest.json');
    const distDir = resolve(__dirname, 'dist');
    const manifestDest = resolve(distDir, 'manifest.json');

    // Create dist directory if it doesn't exist
    if (!existsSync(distDir)) {
        mkdirSync(distDir, {recursive: true});
    }

    const manifest = JSON.parse(readFileSync(manifestSrc, 'utf-8'));

    // 开发时修改 manifest 的 service_worker 路径（指向 dist）
    manifest.background.service_worker = 'background/service-worker.js';
    writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
}

syncManifest();

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
        viteStaticCopy({
            targets: [
                {src: 'src/manifest.json', dest: '.'},
                {src: 'src/background/service-worker.js', dest: './background'},
            ]
        })
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/index.html'),
                option: resolve(__dirname, 'src/option/index.html'),
                newtab: resolve(__dirname, 'src/newtab/index.html'),
            },
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        }
    },
    server: {
        port: 5173,
        host: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    },
    esbuild: {
        target: 'es2020'
    }
})
