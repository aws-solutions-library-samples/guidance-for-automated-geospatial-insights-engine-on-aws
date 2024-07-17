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

/**
 * Polygon specific resources
 */

import { Static, Type } from "@sinclair/typebox";
import { paginationToken } from "../../common/schemas.js";

export const regionId = Type.String({ description: 'Unique Region ID.' });
export const subscriptionId = Type.String({ description: 'Unique Subscription ID.' });
export const createSubscriptionRequestBody = Type.Object(
	{},
	{ $id: 'createSubscriptionRequestBody' }
);

export const createdAt = Type.String({
	description: 'Date/time created',
	format: 'date-time',
});

export const subscriptionResource = Type.Object({
	id: subscriptionId,
	regionId,
	createdAt,
}, { $id: 'subscriptionResource' })
export const deleteSubscriptionRequestBody = Type.Object(
	{
		regionId,
	},
	{ $id: 'deleteSubscriptionRequestBody' }
);

export const count = Type.Optional(
	Type.Integer({
		description: 'No. of results returned when pagination requested.',
	})
);

export const subscriptionListOptions = Type.Object({
	count: Type.Optional(count),
	lastEvaluatedToken: Type.Optional(paginationToken),
});

export type Subscription = Static<typeof subscriptionResource>

export type SubscriptionWithUserId = Subscription & { userId: string, subscriptionArn: string }

export const subscriptionListResource = Type.Object({
	subscriptions: Type.Array(Type.Ref(subscriptionResource)),
	pagination: Type.Optional(
		Type.Object({
			token: Type.Optional(paginationToken),
			count: Type.Number(),
		})
	),
}, { $id: 'subscriptionListResource' })

export type CreateSubscription = Static<typeof createSubscriptionRequestBody>;

export type SubscriptionId = string;

export type SubscriptionList = Static<typeof subscriptionListResource>

export type SubscriptionListOptions = Static<typeof subscriptionListOptions>;
