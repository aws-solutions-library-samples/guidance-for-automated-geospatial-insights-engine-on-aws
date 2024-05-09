import { CreateSubscription, Subscription, SubscriptionList } from "./schemas.js";

export const subscriptionResourceExample: Subscription = {
	regionId: '01hwvwmm5d2crn4xx8k0s0a61z',
	id: '01hwy44p6yjpvkdx4c9g675h55',
	createdAt: '2024-10-02T00:00:00.000Z',
}

export const subscriptionListResourceExample: SubscriptionList = {
	subscriptions: [subscriptionResourceExample]
}
export const subscriptionPostRequestExample: CreateSubscription = {}
