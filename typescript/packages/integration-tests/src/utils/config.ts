import * as dotenv from 'dotenv';
import path from 'path';

export const initializeConfig = (pathToRoot: string, print = true): void => {
	dotenv.config({
		path: path.join(pathToRoot, 'local.env'),
		debug: true,
	});

	if (print) {
		printConfig();
	}
};

export const printConfig = () => {
	console.log('==================== Config: ==================== ');
	Object.entries(process.env)
		.filter(([k]) => k.startsWith('ARCADE_'))
		.sort((a, b) => a[0].localeCompare(b[0]))
		.forEach(([key, value]) => {
			console.log(`\t${key}: ${value}`);
		});
	console.log('================================================= ');
};
