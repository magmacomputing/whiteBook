/** return a ProperCase string of an object's type */
export const getType = (obj?: any): string => {
	const type = Object.prototype.toString.call(obj).slice(8, -1);

	switch (true) {
		case type === 'Object':
			return obj.constructor.name;							// return Class name
		case type === 'Window' && obj === undefined:
			return 'Undefined';												// after Angular8
		case type === 'Window' && obj === null:
			return 'Null';														// after Angular8
		case type === 'Function' && obj.valueOf().toString().startsWith('class '):
			return 'Class';
		default:
			return type;
	}
}

export const isEmpty = <T>(obj: T | Iterable<T>) => {
	switch (getType(obj)) {
		case 'Object':
		case 'String':
			return Object.keys(obj).length === 0;

		case 'Array':
		case 'Set':
		case 'Map':
			return Array.from(obj as Iterable<T>).length === 0;

		default:
			return false;
	}
}

/** Type-Guards: return a boolean to test <obj> is of <type> */
export const isType = (obj: unknown, type: string = 'Object'): boolean => getType(obj).toLowerCase() === type.toLowerCase();
export const isIterable = <T>(obj: T | Iterable<T>): obj is Iterable<T> => Symbol.iterator in Object(obj) && !isString(obj);
export const isNullish = <T>(obj: T | null | undefined): obj is null => ['Null', 'Undefined'].includes(getType(obj));

export const isString = (obj?: unknown): obj is string => isType(obj, 'String');
export const isNumber = (obj?: unknown): obj is number => isType(obj, 'Number');
export const isInteger = (obj?: unknown): obj is bigint => isType(obj, 'BigInt');
export const isBoolean = (obj?: unknown): obj is boolean => isType(obj, 'Boolean');
export const isArray = (obj?: unknown): obj is any[] => isType(obj, 'Array');
export const isObject = (obj?: unknown): obj is Record<string, any> => isType(obj, 'Object');
export const isNull = (obj?: unknown): obj is null => isType(obj, 'Null');
export const isUndefined = (obj?: unknown): obj is undefined => isType(obj, 'Undefined');

export const isDate = (obj?: unknown): obj is Date => isType(obj, 'Date');
export const isFunction = (obj?: unknown): obj is Function => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
export const isClass = (obj?: unknown): obj is Function => isType(obj, 'Class');
export const isPromise = <T>(obj?: unknown): obj is Promise<T> => isType(obj, 'Promise');
export const isBlob = (obj?: unknown): obj is Blob => isType(obj, 'Blob');

export const nullToZero = (obj: number | null | undefined = null) => obj ?? 0;
export const nullToEmpty = <T>(obj: T | null | undefined = null) => obj ?? '';
export const nullToValue = <T>(obj: T | null | undefined = null, value: T) => obj ?? value;

export type TString = string | string[];
export type TNumber = number | number[];

/**
const getType = (obj) => {
	const type = Object.prototype.toString.call(obj).slice(8, -1);
	switch (true) {
			case type === 'Object':
					return obj.constructor.name; // return Class name
			case type === 'Window' && obj === undefined:
					return 'Undefined'; // after Angular8
			case type === 'Window' && obj === null:
					return 'Null'; // after Angular8
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
 */