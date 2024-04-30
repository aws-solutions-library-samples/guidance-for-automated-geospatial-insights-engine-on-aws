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
		this.name = 'InvalidRequest';
	}
}
