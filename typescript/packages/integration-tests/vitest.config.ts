import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 30_000,
		exclude: ['**/node_modules/**', '.history', 'dist'],

		globals: true,

		////// none of these work:
		// testTimeout: 600000,
		hookTimeout: 60_000,
		// teardownTimeout: 600000,

		// onConsoleLog(log: string, type: 'stdout' | 'stderr'): false | void {
		// 	console.log('log in test: ', log);
		// 	if (log === 'message from third party library' && type === 'stdout') {
		// 		return false;
		// 	}
		// },
	},
});
