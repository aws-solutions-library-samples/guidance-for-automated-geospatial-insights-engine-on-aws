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
import { stringEnum } from '../../common/types.js';

export const regionId = Type.String({ description: 'Unique Region ID.' });

export const resultId = Type.String({ description: 'Unique Result ID.' });

export const status = stringEnum(['queued', 'starting', 'inProgress', 'failed', 'succeeded'], 'The status of the pipeline');

export const engineType = stringEnum(['aws-batch'], 'The type of compute used to process the satellite images.');

export const result = Type.Object({
	regionId,
	id: resultId,
	scheduleDateTime: Type.Optional(Type.String({ description: 'The failure reason.' })),
	executionId: Type.Optional(Type.String({ description: 'The id of the execution.' })),
	createdAt: Type.String({ description: 'The creation time of the result' }),
	updatedAt: Type.Optional(Type.String({ description: 'The update time of the result.' })),
	message: Type.Optional(Type.String({ description: 'The failure reason.' })),
	engineType,
	status,
}, { $id: 'resultResource' });

export const count = Type.Optional(
	Type.Integer({
		description: 'No. of results returned when pagination requested.',
	})
);
export const paginationToken = Type.String({
	description: 'Token used to paginate to the next page of search result.',
});

export const resultListOptions = Type.Object({
	count: Type.Optional(count),
	token: Type.Optional(paginationToken),
});

export const resultList = Type.Object(
	{
		results: Type.Array(Type.Ref(result)),
		pagination: Type.Optional(resultListOptions),
	},
	{
		$id: 'resultListResource',
	}
);

export type Result = Static<typeof result>;
export type ResultListOptions = Static<typeof resultListOptions>;
export type ResultList = Static<typeof resultList>;

export type CreateResult = Omit<Result, 'updatedAt' | 'createdAt'>

export type UpdateResult = Pick<Result, 'regionId' | 'id' | 'status' | 'message'>

export type ResultId = string;
