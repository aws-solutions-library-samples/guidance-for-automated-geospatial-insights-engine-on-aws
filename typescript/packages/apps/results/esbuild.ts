import { build } from 'esbuild';
import { dirname as _dirname } from 'path';

const banner = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`;

console.log(`Processing release build...`);
build({
	bundle: true,
	entryPoints: ['src/lambda_eventbridge.ts'],
	minify: true,
	format: 'esm',
	platform: 'node',
	target: 'node20',
	sourcemap: false,
	sourcesContent: false,
	outfile: 'dist/app.mjs',
	banner: {
		js: banner,
	},
});
