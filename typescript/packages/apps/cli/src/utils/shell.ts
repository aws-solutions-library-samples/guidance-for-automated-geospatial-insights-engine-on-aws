import shell from 'shelljs';
import { promisify } from 'util';
import config from './config.js';
import rushlib from '@microsoft/rush-lib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify<string, { silent: boolean }, string>(shell.exec);

export type Folder = string;

const switchToArcadeLocation = async (): Promise<Folder> => {
	console.log(__dirname);
	let arcadeLocation = config.get('arcadePath');
	if (!arcadeLocation) {
		arcadeLocation = path.join(__dirname, '../../../../../');
	}

	const rushConfiguration = rushlib.RushConfiguration.loadFromDefaultLocation({
		startingFolder: arcadeLocation,
	});

	const moduleConfiguration = rushConfiguration.findProjectByShorthandName('@arcade/infrastructure');
	if (!moduleConfiguration) {
		throw new Error('Module @arcade/infrastructure does not exist');
	}
	shell.cd(moduleConfiguration.projectFolder);
	return moduleConfiguration.projectFolder;
};

export { execAsync, switchToArcadeLocation };
