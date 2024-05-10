import Conf from 'conf';

const config = new Conf({
	projectName: 'arcade',
	schema: {
		stacServerPath: {
			type: 'string',
		},
		stacServerApiLambdaFunctionName: {
			type: 'string',
		},
		stacServerIngestionLambdaFunctionName: {
			type: 'string',
		},
		stacServerInitializerLambdaFunctionName: {
			type: 'string',
		},
		stacServerIngestionTopicArn: {
			type: 'string',
		},
		stacServerOpenSearchEndPoint: {
			type: 'string',
		},
		stacServerOpenSearchAccessPolicy: {
			type: 'string',
		},
		arcadePath: {
			type: 'string',
		},
		arcadeEventBridgeName: {
			type: 'string',
		},
	},
});

export default config;
