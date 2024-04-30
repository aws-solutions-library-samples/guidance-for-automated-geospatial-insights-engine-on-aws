import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import type { Static } from '@sinclair/typebox';
import type { configuration, configurationSource } from './schemas.js';

export type DynamoDbItem = Record<string, NativeAttributeValue>;
export type Configuration = Static<typeof configuration>;
export type ConfigurationSource = Static<typeof configurationSource>;
