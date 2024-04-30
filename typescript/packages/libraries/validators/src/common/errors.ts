export class InvalidParameterError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InvalidParameterError';
	}
}
