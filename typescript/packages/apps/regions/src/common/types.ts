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

import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { TIntersect, TSchema, Type } from '@sinclair/typebox';
import type { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
export const apiVersion100: string = '1.0.0';

export type FastifyTypebox = FastifyInstance<RawServerDefault, RawRequestDefaultExpression<RawServerDefault>, RawReplyDefaultExpression<RawServerDefault>, FastifyBaseLogger, TypeBoxTypeProvider>;

export const Nullable = <T extends TSchema>(type: T) => Type.Union([type, Type.Null()]);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function stringEnum<T extends string[]>(values: [...T], description: string, defaultOption?: string) {
	return Type.Unsafe<T[number]>({ type: 'string', enum: values, description, default: defaultOption });
}

export function convertFromTypeBoxIntersectToJSONSchema(intersectTypeBox: TIntersect): any {
	const schema = {
		type: 'object',
		properties: {},
		required: [],
	};
	const requiredSets = new Set<string>();

	for (const definition of intersectTypeBox.allOf) {
		for (const [key, value] of Object.entries(definition['properties'])) {
			schema.properties[key] = value;
		}

		if (definition.hasOwnProperty('required')) {
			for (const req of definition['required']) {
				requiredSets.add(req);
			}
		}
	}
	schema.required = Array.from(requiredSets);
	return schema;
}
