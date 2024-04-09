import esbuild from 'esbuild';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');

if (!existsSync(dist)) {
    mkdirSync(dist);
}

// cjs output bundle
esbuild
    .build({
        outdir: 'dist/cjs',
        bundle: true,
        sourcemap: true,
        minify: false,
        format: 'cjs',
        outExtension: {
            '.js': '.cjs',
        },
        platform: 'node',
        target: ['node18'],
    })
    .catch(() => process.exit(1));

// // an entry file for esm at the root of the bundle
writeFileSync(join(dist, 'index.cjs'), "module.exports = require('./cjs/index.cjs');");
