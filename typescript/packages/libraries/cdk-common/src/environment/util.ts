import { STS } from '@aws-sdk/client-sts';

export interface AwsEnvironment {
	accountId?: string;
	region?: string;
}

const getAwsEnvironment = async (): Promise<AwsEnvironment> => {
	const sts = new STS({});

	let accountId, region;
	try {
		const callerIdentity = await sts.getCallerIdentity({});
		accountId = callerIdentity.Account;
		region = await sts.config.region();
	} catch (Exception) {
		console.log(`Could not retrieve caller identity when fetching environment`);
	}

	return {
		accountId,
		region,
	};
};

export { getAwsEnvironment };
