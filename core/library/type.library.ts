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

type Primitive = string | number | bigint | boolean | symbol | undefined | null;
export const asType = <T>(obj: unknown) => ({ type: getType(obj), value: obj as T, });
export const isType = <T>(obj: unknown, type = 'Object'): obj is T => getType(obj) === type;

/** Type-Guards: return a boolean to test \<obj> is of \<type> */
export const isPrimitive = (obj?: unknown): obj is Primitive => ['String', 'Number', 'BigInt', 'Boolean', 'Symbol', 'Undefined', 'Null'].includes(getType(obj));
export const isReference = (obj?: unknown): obj is Object => !isPrimitive(obj);
export const isIterable = <T>(obj: T | Iterable<T>): obj is Iterable<T> => Symbol.iterator in Object(obj) && !isString(obj);

export const isString = (obj?: unknown): obj is string => isType(obj, 'String');
export const isNumber = (obj?: unknown): obj is number => isType(obj, 'Number');
export const isInteger = (obj?: unknown): obj is bigint => isType(obj, 'BigInt');
export const isBoolean = (obj?: unknown): obj is boolean => isType(obj, 'Boolean');
export const isArray = <T>(obj?: T | T[]): obj is T[] => isType(obj, 'Array');
export const isObject = <T>(obj?: T): obj is NonNullable<typeof obj> => isType(obj, 'Object');
export const isDate = (obj?: unknown): obj is Date => isType(obj, 'Date');

export const isNull = (obj?: unknown): obj is null => isType(obj, 'Null');
export const isNullish = <T>(obj: T | null | undefined): obj is null => ['Null', 'Undefined'].includes(getType(obj));
export const isUndefined = (obj?: unknown): obj is undefined => isType(obj, 'Undefined');
export const isDefined = <T>(obj: T): obj is NonNullable<T> => !isNullish(obj);

export const isClass = (obj?: unknown): obj is Function => isType(obj, 'Class');
export const isFunction = (obj?: unknown): obj is Function => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
export const isPromise = <T>(obj?: unknown): obj is Promise<T> => isType(obj, 'Promise');

export const nullToZero = <T>(obj: T) => obj ?? 0;
export const nullToEmpty = <T>(obj: T) => obj ?? '';
export const nullToValue = <T, R>(obj: T, value: R) => obj ?? value;

export const isEmpty = <T>(obj?: T) => false
	|| isNull(obj)
	|| isUndefined(obj)
	|| (isString(obj) && obj.trim() === '')
	|| (isObject(obj) && Object.keys(obj).length === 0)
	|| (isArray(obj) && obj.length === 0)
	|| (getType(obj) === 'Set' && (obj as unknown as Set<T>).size === 0)
	|| (getType(obj) === 'Map' && (obj as unknown as Map<any, T>).size === 0)

export function assertCondition(condition: any, message?: string): asserts condition {
	if (!condition)
		throw new Error(message);
}
export function assertString(str: unknown): asserts str is string { assertCondition(isString(str), `Invalid string: ${str}`) };
export function assertNever(val: never): asserts val is never { throw new Error(`Unexpected object: ${val}`) };

export type TString = string | string[];
export type TNumber = number | number[];
export type valueOf<T> = T[keyof T];

export const getEnumKeys = (enumType: Record<string | number, any>) => Object.keys(enumType).filter(key => isNaN(Number(key)));
export const getEnumCount = (enumType: Record<string | number, any>) => getEnumKeys(enumType).length;
export const getEnumValues = (enumType: Record<string | number, any>) => getEnumKeys(enumType).map(key => enumType[key]);
export const getEnumEntries = (enumType: Record<string | number, any>) => getEnumKeys(enumType).map(key => [key, enumType[key]]);
