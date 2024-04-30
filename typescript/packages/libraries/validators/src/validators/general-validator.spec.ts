import { describe, it, expect } from 'vitest';
import { validateAtLeast, validateDefined, validateHasSome, validateNotEmpty } from './general-validators.js';

describe('general validator', () => {
	it('validateDefined - valid', () => {
		validateDefined(1, 'test');
		validateDefined('a', 'test');
		validateDefined(false, 'test');
		validateDefined({ foo: 'bar' }, 'test');
		validateDefined(['one'], 'test');
	});
	it('validateDefined - invalid', () => {
		expect(() => validateDefined(undefined, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateDefined(null, 'test')).toThrowError("Missing required parameter 'test'");
	});
	it('validateNotEmpty - valid', () => {
		validateNotEmpty(1, 'test');
		validateNotEmpty('a', 'test');
		validateNotEmpty(false, 'test');
		validateNotEmpty({ foo: 'bar' }, 'test');
		validateNotEmpty(['one'], 'test');
	});
	it('validateNotEmpty - invalid', () => {
		expect(() => validateNotEmpty(undefined, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateNotEmpty(null, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateNotEmpty('', 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateNotEmpty([], 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateNotEmpty({}, 'test')).toThrowError("Missing required parameter 'test'");


	});
	it('validateAtLeast - valid', () => {
		validateAtLeast(5, 5, 'test');
		validateAtLeast(10, 5, 'test');
	});
	it('validateAtLeast - invalid', () => {
		expect(() => validateAtLeast(undefined, 1, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateAtLeast(null, 1, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateAtLeast(-5, 1, 'test')).toThrowError("Missing required parameter 'test'");
		expect(() => validateAtLeast(5, 10, 'test')).toThrowError("Missing required parameter 'test'");
	});
	it('validateHasSome - valid', () => {
		validateHasSome(['one', 2], ['a', 'b']);
		validateHasSome([undefined, 2], ['a', 'b']);
		validateHasSome(['one', undefined], ['a', 'b']);
		validateHasSome([[], undefined], ['a', 'b']);
		validateHasSome([true, undefined], ['a', 'b']);
		validateHasSome([{}, undefined], ['a', 'b']);
	});
	it('validateHasSome - invalid', () => {
		expect(() => validateHasSome([undefined, undefined], ['a', 'b'])).toThrowError('At least one of a, b is required');
		expect(() => validateHasSome([null, null], ['a', 'b'])).toThrowError('At least one of a, b is required');
	});
});
