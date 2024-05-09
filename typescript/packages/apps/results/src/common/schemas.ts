import { Type } from "@sinclair/typebox";
import { apiVersion100 } from "./types.js";

/**
 * Common headers
 */
export const commonHeaders = Type.Object({
	'accept-version': Type.String({ description: 'API version', default: apiVersion100 }),
	accept: Type.String({ description: 'Accepted Content Type', default: 'application/json' }),
});

export const countPaginationQS = Type.Integer({ description: 'Count of results to return, if not specified default to 20', default: 20 });
export const fromIdPaginationQS = Type.Optional(Type.String({ description: 'Id to paginate from (exclusive).' }));
export const fromTokenPaginationQS = Type.Optional(Type.String({ description: 'Token used to paginate from (exclusive).' }));
