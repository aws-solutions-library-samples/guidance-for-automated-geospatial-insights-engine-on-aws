import { execSync } from 'child_process';
import esbuild from 'esbuild';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');

if (!existsSync(dist)) {
	mkdirSync(dist);
}

const entryPoints = ['src/index.ts', 'src/invoker.ts', 'src/models.ts'];

console.log(`logging works`);
// esm output bundle
esbuild
	.build({
		entryPoints,
		outdir: 'dist/esm',
		bundle: false,
		sourcemap: true,
		minify: false,
		format: 'esm',
		platform: 'node',
		target: ['node20'],
		plugins: [
			{
				name: 'TypeScriptDeclarationsPlugin',
				setup(build) {
					build.onEnd((result) => {
						if (result.errors.length > 0) return;
						execSync('tsc');
					});
				},
			},
		],
	})
	.catch((e) => {
		console.log(e);
		process.exit(1);
	});

// cjs output bundle
esbuild
	.build({
		entryPoints: ['src/index.ts'],
		outdir: 'dist/cjs',
		bundle: true,
		sourcemap: true,
		minify: false,
		format: 'cjs',
		outExtension: {
			'.js': '.cjs',
		},
		platform: 'node',
		target: ['node20'],
	})
	.catch((e) => {
		console.log(e);
		process.exit(1);
	});

// an entry file for esm at the root of the bundle
writeFileSync(join(dist, 'index.js'), "export * from './esm/index.js';");

// an entry file for cjs at the root of the bundle
writeFileSync(join(dist, 'index.cjs'), "module.exports = require('./cjs/index.cjs');");
