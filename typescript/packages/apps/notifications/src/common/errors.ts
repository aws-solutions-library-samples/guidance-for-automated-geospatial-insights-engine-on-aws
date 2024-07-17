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

export class NotFoundError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class ConflictError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export class StacItemDefinitionError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'StacItemDefinitionError';
	}
}

export class InvalidParameterError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InvalidParameterError';
	}
}

export function handleError(error, _request, reply) {
	// Log error
	this.log.error(`***** error: ${JSON.stringify(error)}`);
	this.log.error(`***** error.code: ${error.code}`);
	this.log.error(`***** error.name: ${error.name}`);
	this.log.error(`***** error.message: ${error.message}`);

	if (error.statusCode === 400 || Array.isArray(error.validation)) {
		return error;
	} else {
		switch (error.name) {
			case 'InvalidStateError':
				return reply.conflict(error.message);
			case 'InvalidRequestError':
			case 'InvalidNameError':
			case 'ArgumentError':
				return reply.badRequest(error.message);
			case 'NotFoundError':
				return reply.notFound(error.message);
			case 'ConflictError':
				return reply.conflict(error.message);
			case 'UnauthorizedError':
				return reply.unauthorized(error.message);
			case 'InvalidTokenError':
			case 'ForbiddenError':
			case 'ExpiredTokenException':
				return reply.forbidden(error.message);
			case 'NotImplementedError':
				return reply.notImplemented(error.message);
			case 'DatabaseTransactionError':
				return reply.internalServerError(error.message);
			default:
				return reply.imateapot(`${error.name}: ${error.message}`);
		}
	}
}
