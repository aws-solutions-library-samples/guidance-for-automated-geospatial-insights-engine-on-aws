export const eventBusName = `arcade-shared-bus`;
export const eventBusArn = (accountId: string, region: string) => `arn:aws:events:${region}:${accountId}:event-bus/${eventBusName}`;
export const eventBusNameParameter = `/arcade/shared/eventBusName`;
export const eventBusArnParameter = `/arcade/shared/eventBusArn`;
