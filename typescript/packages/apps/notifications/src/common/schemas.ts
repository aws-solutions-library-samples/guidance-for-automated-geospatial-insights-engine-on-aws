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
export const paginationToken = Type.String({ description: 'Token used to paginate to the next page of search result.' });

export const badRequestResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'badRequestResponse', description: 'Bad request.' }
);

export const forbiddenResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'forbiddenResponse', description: 'Forbidden.' }
);

export const notFoundResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'notFoundResponse', description: 'Not found.' }
);

export const noBodyResponse = Type.Object({}, { $id: 'noBodyResponse', description: 'Success.' });

export const conflictResponse = Type.Object(
	{
		message: Type.String(),
		syntaxErrors: Type.Optional(
			Type.Object({
				charPositionInLine: Type.Integer(),
				line: Type.Integer(),
				msg: Type.String(),
			})
		),
	},
	{ $id: 'conflictResponse', description: 'Conflict.' }
);
