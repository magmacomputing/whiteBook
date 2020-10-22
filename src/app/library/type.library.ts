/** return a ProperCase string of an object's type */
export const getType = (obj?: any): string => {
	const type = Object.prototype.toString.call(obj).slice(8, -1);

	switch (true) {
		case type === 'Object':
			return obj.constructor.name;							// return Object name

		case type === 'Function' && obj.valueOf().toString().startsWith('class '):
			return 'Class';

		default:
			return type;
	}
}

export const asType = <T>(obj: unknown) => ({ type: getType(obj), value: obj as T, })
export const isType = (obj: unknown, type: string = 'Object'): boolean => getType(obj).toLowerCase() === type.toLowerCase();

/** Type-Guards: return a boolean to test <obj> is of <type> */
export const isIterable = <T>(obj: T | Iterable<T>): obj is Iterable<T> => Symbol.iterator in Object(obj) && !isString(obj);
export const isNullish = <T>(obj: T | null | undefined): obj is null => ['Null', 'Undefined'].includes(getType(obj));

export const isString = (obj?: unknown): obj is string => isType(obj, 'String');
export const isNumber = (obj?: unknown): obj is number => isType(obj, 'Number');
export const isInteger = (obj?: unknown): obj is bigint => isType(obj, 'BigInt');
export const isBoolean = (obj?: unknown): obj is boolean => isType(obj, 'Boolean');
export const isArray = <T>(obj: T[] | any): obj is T[] => isType(obj, 'Array');
export const isObject = <T>(obj?: T): obj is NonNullable<typeof obj> => isType(obj, 'Object');
export const isNull = (obj?: unknown): obj is null => isType(obj, 'Null');
export const isUndefined = (obj?: unknown): obj is undefined => isType(obj, 'Undefined');
export const isDefined = <T>(obj: T): obj is T => !isType(obj, 'Undefined');

export const isDate = (obj?: unknown): obj is Date => isType(obj, 'Date');
export const isFunction = (obj?: unknown): obj is Function => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
export const isClass = (obj?: unknown): obj is Function => isType(obj, 'Class');
export const isPromise = <T>(obj?: unknown): obj is Promise<T> => isType(obj, 'Promise');
export const isBlob = (obj?: unknown): obj is Blob => isType(obj, 'Blob');

export const nullToZero = (obj: number | undefined | null) => obj ?? 0;
export const nullToEmpty = <T>(obj: T | undefined | null) => obj ?? '';
export const nullToValue = <T, R>(obj: T | undefined | null, value: R) => obj ?? value;

export const isEmpty = <T>(obj?: T | Iterable<T>) =>
	isNull(obj)
	|| isUndefined(obj)
	|| (isString(obj) && obj.trim() === '')
	|| (isObject(obj) && Object.keys(obj).length === 0)
	|| (isArray(obj) && obj.length === 0)
	|| (getType(obj) === 'Set' && (obj as Set<T>).size === 0)
	|| (getType(obj) === 'Map' && (obj as Map<string, T>).size === 0)

export function assertCondition(condition: any, message?: string): asserts condition {
	if (!condition)
		throw new Error(message);
}
export function assertString(str: unknown): asserts str is string { assertCondition(isString(str), `Invalid string: ${str}`) };
export function assertNever(val: never): asserts val is never { throw new Error(`Unexpected object: ${val}`) };

export type TString = string | string[];
export type TNumber = number | number[];
export type valueOf<T> = T[keyof T];

/**
const getType = (obj) => {
	const type = Object.prototype.toString.call(obj).slice(8, -1);
	switch (true) {
			case type === 'Object':
					return obj.constructor.name; // return Object name
			case type === 'Function' && obj.valueOf().toString().startsWith('class '):
					return 'Class';
			default:
					return type;
	}
}
const isEmpty = (obj) => {
	switch (getType(obj)) {
			case 'Object':
					return Object.keys(obj).length === 0;
			case 'String':
			case 'Array':
			case 'Set':
			case 'Map':
					return Array.from(obj).length === 0;
			default:
					return false;
	}
};

const isType = (obj, type = 'Object') => getType(obj).toLowerCase() === type.toLowerCase();
const isIterable = (obj) => Symbol.iterator in Object(obj) && !isString(obj);
const isString = (obj) => isType(obj, 'String');
const isNumber = (obj) => isType(obj, 'Number');
const isInteger = (obj) => isType(obj, 'BigInt');
const isBoolean = (obj) => isType(obj, 'Boolean');
const isObject = (obj) => isType(obj, 'Object');
const isArray = (obj) => isType(obj, 'Array');
const isNull = (obj) => isType(obj, 'Null');
const isUndefined = (obj) => isType(obj, 'Undefined');
const isDate = (obj) => isType(obj, 'Date');
const isFunction = (obj) => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
const isClass = (obj) => isType(obj, 'Class');
const isPromise = (obj) => isType(obj, 'Promise');
const isBlob = (obj) => isType(obj, 'Blob');
const nullToZero = (obj) => obj ?? 0;
const nullToEmpty = (obj) => obj ?? '';
const nullToValue = (obj, value) => obj ?? value;
const isNullish = (obj) => ['Null', 'Undefined'].includes(getType(obj));
 */