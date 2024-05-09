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
