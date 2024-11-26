import { defineConfig } from 'electron-vite';
import { Plugin, TransformResult } from 'vite';
import viteChecker from 'vite-plugin-checker';
import viteCp from 'vite-plugin-cp';
import { minify } from 'html-minifier-terser';

export default defineConfig({
    main: {
        plugins: [
            viteChecker({
                typescript: true,
            }),
        ],
        build: {
            minify: true,
            outDir: 'dist/main',
            lib: {
                entry: 'src/main/index.ts',
                formats: ['cjs'],
            },
        },
    },
    preload: {
        plugins: [
            viteChecker({
                typescript: true,
            }),
        ],
        build: {
            minify: true,
            outDir: 'dist/preload',
            lib: {
                entry: 'src/preload/index.ts',
                formats: ['cjs'],
            },
        },
    },
    renderer: {
        plugins: [
            viteChecker({
                typescript: true,
            }),
            viteCp({
                targets: [
                    { src: 'manifest.json', dest: 'dist' },
                ],
            }),
            (() => ({
                async transform(code, id) {
                    if (!id.endsWith('.html?raw')) return;
                    return {
                        code: `export default ${JSON.stringify(
                            await minify(
                                JSON.parse(code.replace(/^export default /, '')),
                                {
                                    collapseWhitespace: true,
                                    collapseBooleanAttributes: true,
                                    decodeEntities: true,
                                    removeComments: true,
                                    removeRedundantAttributes: true,
                                    removeScriptTypeAttributes: true,
                                    removeStyleLinkTypeAttributes: true,
                                    removeEmptyAttributes: true,
                                    useShortDoctype: true,
                                    sortAttributes: true,
                                    sortClassName: true,
                                    processConditionalComments: true,
                                    minifyCSS: true,
                                    minifyJS: true,
                                }
                            )
                        )}`,
                    } as TransformResult;
                },
            } as Plugin))(),
        ],
        build: {
            // “注意，在 lib 模式下使用 'es' 时，build.minify 选项不会缩减空格，因为会移除掉 pure 标注，导致破坏 tree-shaking。”
            // 暂时改成自己另外使用esbuild来minify
            // Lib mode format: es.min · Issue #6555 · vitejs/vite
            // https://github.com/vitejs/vite/issues/6555
            // minify: true,
            outDir: 'dist/renderer',
            lib: {
                entry: 'src/renderer/index.ts',
                formats: ['es'],
                fileName: () => 'index.js',
            },
            rollupOptions: {
                input: 'src/renderer/index.ts',
            },
        },
    },
});