import Conf from 'conf';

const config = new Conf({
	projectName: 'arcade',
	schema: {
		arcadePath: {
			type: 'string',
		}
	},
});

export default config;
