import validator from 'validator';
import { InvalidParameterError } from '../common/errors.js';

const MISSING_REQUIRED_PARAMETER = (name) => `Missing required parameter '${name}'`;

export const validateDefined = (value: unknown, name: string) => {
	if (value === undefined || value === null) {
		throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
	}
};
export const validateNotEmpty = (value: unknown, name: string) => {
	if (value === undefined || value === null) {
		throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
	} else if (Array.isArray(value)) {
		if ((value?.length ?? 0) === 0) {
			throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
		}
	} else if (typeof value === 'string' && validator.isEmpty(value)) {
		throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
	} else if (typeof value === 'object' && !(value instanceof Date) && (Object.keys(value)?.length ?? 0) === 0) {
		throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
	}
};

export const validateAtLeast = (value: number, expected: number, name: string) => {
	if ((value ?? 0) < expected) {
		throw new InvalidParameterError(MISSING_REQUIRED_PARAMETER(name));
	}
};

export const validateHasSome = <T>(values: T[], names: string[]) => {
	const hasSome = (values ?? []).some((value) => value !== undefined && value !== null);
	if (!hasSome) {
		throw new InvalidParameterError(`At least one of ${names.join(', ')} is required`);
	}
};

export const validateRegularExpression = (value: string, name: string, regex:string) => {
	const reg = new RegExp(regex);
	if (!reg.test(value)) {
		throw new InvalidParameterError(`${name} value must satisfy regular expression pattern: ${regex}`);
	}
};
