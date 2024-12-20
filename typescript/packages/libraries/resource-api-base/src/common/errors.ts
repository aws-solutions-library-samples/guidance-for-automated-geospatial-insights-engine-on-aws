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

export class UnauthorizedError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'UnauthorizedError';
	}
}

export class ForbiddenError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ForbiddenError';
	}
}

export class QueryParameterError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'QueryParameterError';
	}
}

export class NotFoundError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class ResourceInUseError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ResourceInUseError';
	}
}

export class NotImplementedError extends Error {
	public constructor(message?: string) {
		super(message);
		this.name = 'NotImplementedError';
	}
}

export class InvalidNameError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InvalidNameError';
	}
}

export class ConflictError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export class InvalidStateError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InvalidStateError';
	}
}

export class InvalidRequestError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InvalidRequestError';
	}
}
