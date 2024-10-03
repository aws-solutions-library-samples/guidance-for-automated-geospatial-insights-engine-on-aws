import { DescribeSubnetsCommand, DescribeSubnetsCommandInput, DescribeVpcsCommand } from '@aws-sdk/client-ec2';
import { ListInstanceTypeDetailsCommand } from '@aws-sdk/client-opensearch';
import { GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { checkbox, confirm, input, select } from '@inquirer/prompts';
import { JSONSchemaType } from 'ajv';
import validator from 'validator';
import { getEc2Client, getOpenSearchClient, getSSMClient } from './awsClient.js';

export interface ContextAnswer {
	administratorEmail: string;
	administratorPhoneNumber: string;
	deleteBucket: boolean;
	// optional configuration for SES Cognito integration
	cognitoFromEmail?: string;
	cognitoVerifiedDomain?: string;
	cognitoFromName?: string;
	cognitoReplyToEmail?: string;
	concurrencyLimit: number;
	// STAC server configuration
	configureStacServer: boolean;
	stacServerInstanceType?: string;
	stacServerVolumeType?: string;
	stacServerVolumeSize?: number;
	stacServerInstanceCount?: number;
	stacServerDedicatedMasterEnabled?: boolean;
	stacServerZoneAwarenessEnabled?: boolean;
	// additional cache layer to improve Region API performance
	useRegionCache?: boolean;
	// network configuration
	useExistingVpc?: boolean;
	existingVpcId?: string;
	userIsolatedSubnetIds?: (string | undefined)[];
	userPrivateSubnetIds?: (string | undefined)[];
	userPublicSubnetIds?: (string | undefined)[];
	availabilityZones?: (string | undefined)[];
}

export const schema: JSONSchemaType<ContextAnswer> = {
	type: 'object',
	properties: {
		administratorEmail: { type: 'string', nullable: false },
		administratorPhoneNumber: { type: 'string', nullable: false },
		deleteBucket: { type: 'boolean' },
		configureStacServer: { type: 'boolean' },
		cognitoFromEmail: { type: 'string', nullable: true },
		cognitoVerifiedDomain: { type: 'string', nullable: true },
		cognitoFromName: { type: 'string', nullable: true },
		cognitoReplyToEmail: { type: 'string', nullable: true },
		concurrencyLimit: { type: 'number' },
		stacServerInstanceType: { type: 'string', nullable: true },
		stacServerVolumeType: { type: 'string', nullable: true },
		stacServerVolumeSize: { type: 'number', nullable: true },
		stacServerInstanceCount: { type: 'number', nullable: true },
		stacServerDedicatedMasterEnabled: { type: 'boolean', nullable: true },
		stacServerZoneAwarenessEnabled: { type: 'boolean', nullable: true },
		useRegionCache: { type: 'boolean', nullable: true },
		useExistingVpc: { type: 'boolean', nullable: true },
		existingVpcId: { type: 'string', nullable: true },
		userIsolatedSubnetIds: { type: 'array', items: { type: 'string', nullable: true }, nullable: true },
		userPrivateSubnetIds: { type: 'array', items: { type: 'string', nullable: true }, nullable: true },
		userPublicSubnetIds: { type: 'array', items: { type: 'string', nullable: true }, nullable: true },
		availabilityZones: { type: 'array', items: { type: 'string', nullable: true }, nullable: true },
	},
	required: ['administratorEmail', 'administratorPhoneNumber'],
	additionalProperties: true,
};

export class AnswersBuilder {
	private readonly parameterName: string;
	constructor(
		private readonly environment: string,
		private readonly region: string,
		private readonly roleArn?: string,
	) {
		this.parameterName = `/agie/${environment}/config`;
	}

	public async loadFromUsers(answers: ContextAnswer): Promise<ContextAnswer> {
		answers.administratorEmail = await input({
			message: 'Enter your email address:',
			validate: (a: string) => {
				if (!validator.isEmail(a)) return 'Invalid email address. Please enter a valid email address.';

				return true;
			},
			default: answers.administratorEmail,
		});

		answers.administratorPhoneNumber = await input({
			message: 'Enter your mobile phone number (with country code):',
			default: answers.administratorPhoneNumber,
			validate: (a: string) => {
				if (!validator.isMobilePhone(a, 'any', { strictMode: true })) return 'Invalid mobile phone number. Please enter a valid number with the country code.';
				return true;
			},
		});

		answers.configureStacServer = await confirm({
			message: 'Do you want to configure the OpenSearch server used by STAC Server?',
			default: answers.configureStacServer ?? false,
		});

		const openSearchClient = await getOpenSearchClient(this.region, this.roleArn);

		if (answers.configureStacServer) {
			const openSearchInstanceTypes = (await openSearchClient.send(new ListInstanceTypeDetailsCommand({ EngineVersion: 'OpenSearch_2.11' })))
				.InstanceTypeDetails!.sort((a, b) => a.InstanceType!.localeCompare(b.InstanceType!))
				.map((o) => ({ name: o.InstanceType, value: o.InstanceType }));

			answers.stacServerDedicatedMasterEnabled = await confirm({
				message: `A dedicated master node is a cluster node that performs cluster management tasks, but doesn't hold data or respond to data upload requests.\r\n  Dedicated master nodes offload cluster management tasks to increase the stability of your search clusters.\r\n  Do you want to use a dedicated master node for the OpenSearch Service domain?`,
				default: answers.stacServerDedicatedMasterEnabled ?? false,
			});

			answers.stacServerZoneAwarenessEnabled = await confirm({
				message: `When you enable zone awareness, OpenSearch Service allocates the nodes and replica index shards that belong to a cluster across two Availability Zones (AZs) in the same region to prevent data loss and minimize downtime in the event of node or data center failure.\r\n  Don't enable zone awareness if your cluster has no replica index shards or is a single-node cluster\r\n  Do you want to enable zone awareness for the OpenSearch Service domain?`,
				default: answers.stacServerZoneAwarenessEnabled ?? false,
			});

			answers.stacServerInstanceType = await select({
				message: 'The instance type for your data nodes:',
				choices: openSearchInstanceTypes,
				default: answers.stacServerInstanceType ?? 'c5.large.search',
			});

			answers.stacServerInstanceCount = parseInt(
				await input({
					message: 'The number of data nodes (instances) to use in the OpenSearch Service domain:',
					default: '1',
					validate: (num: string) => {
						if (validator.toInt(num) < 1) return 'Num of data nodes must be more than 1.';
						return true;
					},
				}),
			);

			answers.stacServerVolumeSize = parseInt(
				await input({
					message:
						'The size (in GiB) of the EBS volume for each data node. The minimum and maximum size of an EBS volume depends on the EBS volume type and the instance type to which it is attached:',
					default: answers.stacServerVolumeSize?.toString() ?? '20',
					validate: (num: string) => {
						if (validator.toInt(num) < 20) return 'The size (in GiB) of the EBS volume must be more or equal than';
						return true;
					},
				}),
			);

			answers.stacServerVolumeType = await select({
				message: 'The EBS volume type to use with the OpenSearch Service domain:',
				choices: ['standard', 'gp2', 'io1', 'gp3'].map((o) => ({ name: o, value: o })),
				default: answers.stacServerVolumeType ?? 'gp3',
			});
		}

		answers.deleteBucket = await confirm({ message: 'Do you want to delete all the provisioned s3 buckets when AGIE is removed?', default: answers.deleteBucket ?? false });

		answers.useRegionCache = await confirm({
			message: 'Do you want to enable memory cache for Regions API to improve query performance?',
			default: answers.useRegionCache ?? false,
		});

		answers.useExistingVpc = await confirm({
			message: 'Do you want to use an existing VPC? If not, the AGIE deployment will create one for you.',
			default: answers.useExistingVpc ?? false,
		});

		const ec2Client = await getEc2Client(this.region, this.roleArn);

		if (answers.useExistingVpc) {
			const existingVpcList =
				(await ec2Client.send(new DescribeVpcsCommand({}))).Vpcs?.map((vpc) => {
					const vpcName = vpc.Tags?.find((t) => {
						return t.Key === 'Name';
					});
					return {
						name: vpcName ? vpcName.Value : vpc.VpcId,
						value: vpc.VpcId,
					};
				}) ?? [];

			answers.existingVpcId = await select({
				message: 'Select the existing VPC to use when deploying AGIE:',
				choices: existingVpcList,
				default: answers.existingVpcId,
			});

			if (answers.existingVpcId === undefined) {
				throw new Error('VPC ID is required if using an existing VPC');
			}

			const describeSubnetsInput: DescribeSubnetsCommandInput = {
				Filters: [{ Name: 'vpc-id', Values: [answers.existingVpcId] }],
			};

			const allSubnets = (await ec2Client.send(new DescribeSubnetsCommand(describeSubnetsInput))).Subnets;

			const availabilityZoneSet = new Set<string>();
			allSubnets?.forEach((o) => availabilityZoneSet.add(o.AvailabilityZone!));
			answers.availabilityZones = Array.from(availabilityZoneSet);

			const existingVpcSubnets = (
				allSubnets?.map((s) => {
					const subnetName = s.Tags?.find((t) => {
						return t.Key === 'Name';
					});

					return {
						name: subnetName ? subnetName.Value : s.SubnetId,
						value: s.SubnetId,
					};
				}) ?? []
			).sort((a, b) => a.name!.localeCompare(b.name!));

			answers.userIsolatedSubnetIds = await checkbox({
				message: `Which subnets in vpc ${answers.existingVpcId} should AGIE use as isolated subnets?`,
				required: true,
				choices: existingVpcSubnets,
				loop: false,
			})!;

			const nonIsolatedSubnets: { name: string | undefined; value: string | undefined }[] = [];

			existingVpcSubnets.forEach((s) => {
				if (!answers.userIsolatedSubnetIds?.some((esid) => esid === s.value)) {
					nonIsolatedSubnets.push(s);
				}
			});

			answers.userPrivateSubnetIds = await checkbox({
				message: `Which subnets in vpc ${answers.existingVpcId}  should AGIE use as private subnets?`,
				choices: nonIsolatedSubnets.sort((a, b) => a.name!.localeCompare(b.name!)),
				loop: false,
			});

			const nonPrivateAndIsolatedSubnets: { name: string | undefined; value: string | undefined }[] = [];

			existingVpcSubnets.forEach((s) => {
				if (!answers.userIsolatedSubnetIds?.some((esid) => esid === s.value) && !answers.userPrivateSubnetIds?.some((esid) => esid === s.value)) {
					nonPrivateAndIsolatedSubnets.push(s);
				}
			});

			answers.userPublicSubnetIds = await checkbox({
				message: `Which subnets in vpc ${answers.existingVpcId}  should AGIE use as public subnets?`,
				choices: nonPrivateAndIsolatedSubnets.sort((a, b) => a.value!.localeCompare(b.value!)),
				loop: false,
			});
		}

		return answers;
	}

	public async saveToParameterStore(answers: ContextAnswer): Promise<void> {
		const ssmClient = await getSSMClient(this.region, this.roleArn);
		await ssmClient.send(new PutParameterCommand({ Name: this.parameterName, Value: JSON.stringify(answers), Type: 'String', Overwrite: true }));
	}

	public async loadFromParameterStore(): Promise<ContextAnswer> {
		const ssmClient = await getSSMClient(this.region, this.roleArn);
		let response: ContextAnswer = {
			administratorEmail: '',
			administratorPhoneNumber: '',
			deleteBucket: false,
			concurrencyLimit: 10,
			useRegionCache: false,
			useExistingVpc: false,
			configureStacServer: false,
		};

		try {
			const answers = await ssmClient.send(new GetParameterCommand({ Name: this.parameterName }));
			response = JSON.parse(answers.Parameter?.Value!);
		} catch (Exception) {}

		return response;
	}
}
