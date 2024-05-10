import { Command, Flags } from '@oclif/core';
import { simpleGit } from 'simple-git';
import * as fs from 'fs';
import path from 'path';
import config from '../../utils/config.js';

const { STAC_SERVER_FOLDER_NAME: stacServerFolderName, STAC_SERVER_REPOSITORY_URL: stacServerRepositoryUrl } = process.env;

export default class StacServerClone extends Command {
	public static description = 'Clone STAC server into current folder';
	public static examples = ['<%= config.bin %> <%= command.id %> -r https://github.com/stac-utils/stac-server'];

	public static flags = {
		repositoryUrl: Flags.string({
			char: 'r',
			description: 'Url of STAC server repository',
			required: false,
			aliases: ['repository-url'],
			default: 'https://github.com/stac-utils/stac-server.git',
		}),
		branch: Flags.string({
			char: 'b',
			description: 'The branch of the STAC server to be used for deployment',
			required: false,
			aliases: ['repository-branch'],
			default: 'v3.5.0',
		}),
	};

	public async run(): Promise<void> {
		this.log(`Staring to clone stac server !!!`);
		const { flags } = await this.parse(StacServerClone);

		//set Default repo url
		if (!flags?.repositoryUrl) {
			flags.repositoryUrl = 'https://github.com/stac-utils/stac-server.git';
		}

		let folderName = stacServerFolderName!;
		if (!folderName) {
			folderName = 'stac-server-repo';
		}
		const folderPath = path.join(process.cwd(), folderName);
		config.set('stacServerPath', folderPath);

		const repository = flags.repositoryUrl ?? stacServerRepositoryUrl!;
		this.log(`Cloning 📦 ${repository} into 📁 ${folderPath}`);

		let stacServerGit;
		if (!fs.existsSync(folderName)) {
			stacServerGit = simpleGit().outputHandler((_command, stdout, stderr) => {
				stdout.pipe(process.stdout);
				stderr.pipe(process.stderr);
			});
			// We lock down the stac server repo to V3.5.0
			await stacServerGit.clone(repository, folderName, { '--branch': flags?.branch ? flags.branch : 'v3.5.0', '--single-branch': null, '-c advice.detachedHead': 'false' });
		} else {
			this.warn(`folder ${folderName} already exists`);
		}

		await config.get('stacServerPath');

		this.log(`Finished cloning the stac server!!!`);
	}
}
