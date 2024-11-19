/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */
import { Static, Type } from '@sinclair/typebox';

import { createdAt, createdBy, updatedAt, updatedBy } from '@agie/resource-api-base';

export const engineNew = Type.Object(
	{
		name: Type.String({
			description: `The name of the job definition to register. It can be up to 128 letters long. It can
     *       contain uppercase and lowercase letters, numbers, hyphens (-), and underscores (_)`,
			pattern: '^[a-zA-Z0-9-_]+$',
		}),
		jobRoleArn: Type.String({ description: 'IAM role ARN that the container can assume for Amazon Web Services permissions.' }),
		image: Type.String({
			description:
				'The image used to start a container. This string is passed directly to the Docker daemon. By default, images in the Docker Hub registry are available. Other repositories are specified with either repository-url/image:tag or repository-url/image@digest.',
		}),
		memory: Type.Number({ description: 'The memory hard limit (in MiB) present to the container.' }),
		vcpus: Type.Number({ description: 'The number of vCPUs reserved for the container.' }),
		environment: Type.Record(Type.String(), Type.String(), { description: 'The environment variables to pass to a container.', default: {} }),
	},
	{ $id: 'engine_new' }
);

export const engineUpdate = Type.Object(
	{
		jobRoleArn: Type.Optional(Type.String({ description: 'IAM role ARN that the container can assume for Amazon Web Services permissions.' })),
		image: Type.Optional(
			Type.String({
				description:
					'The image used to start a container. This string is passed directly to the Docker daemon. By default, images in the Docker Hub registry are available. Other repositories are specified with either repository-url/image:tag or repository-url/image@digest.',
			})
		),
		memory: Type.Optional(Type.Number({ description: 'The memory hard limit (in MiB) present to the container.' })),
		vcpus: Type.Optional(Type.Number({ description: 'The number of vCPUs reserved for the container.' })),
		environment: Type.Optional(Type.Record(Type.String(), Type.String(), { description: 'The environment variables to pass to a container.' })),
	},
	{ $id: 'engine_update' }
);

export const engineId = Type.String({ description: 'Engine resource id.' });

export const fromEngineIdPagination = Type.Optional(Type.String({ description: 'Last evaluated engine Id' }));

export const engineResource = Type.Object(
	{
		id: engineId,
		name: Type.String({ description: 'name of the engine.' }),
		jobRoleArn: Type.String({ description: 'IAM role ARN that the container can assume for Amazon Web Services permissions.' }),
		jobDefinitionArn: Type.String({ description: 'AWS Batch Job Definition Arn for the engine.' }),
		image: Type.String({
			description:
				'The image used to start a container. This string is passed directly to the Docker daemon. By default, images in the Docker Hub registry are available. Other repositories are specified with either repository-url/image:tag or repository-url/image@digest.',
		}),
		memory: Type.Number({ description: 'The memory hard limit (in MiB) present to the container.' }),
		vcpus: Type.Number({ description: 'The number of vCPUs reserved for the container.' }),
		environment: Type.Record(Type.String(), Type.String(), { description: 'The environment variables to pass to a container.', default: {} }),
		updatedAt: Type.Optional(updatedAt),
		updatedBy: Type.Optional(updatedBy),
		createdAt,
		createdBy,
	},
	{
		$id: 'engine_resource',
	}
);

export const engineList = Type.Object(
	{
		engines: Type.Array(Type.Ref(engineResource)),
		pagination: Type.Optional(
			Type.Object({
				lastEvaluated: Type.Optional(engineId),
			})
		),
	},
	{
		$id: 'engine_list',
	}
);

export type EngineResource = Static<typeof engineResource>;
export type EngineResourceList = Static<typeof engineList>;
export type EngineNew = Static<typeof engineNew>;
export type EngineUpdate = Static<typeof engineUpdate>;
