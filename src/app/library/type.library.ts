/** return a ProperCase string of an object's type */
export const getType = (obj?: any): string => Object.prototype.toString.call(obj).slice(8, -1);

/** return a boolean if obj matches type */
export const isType = (obj: any, type: string = 'Object'): boolean => getType(obj).toLowerCase() === type.toLowerCase();

export const isString = (obj?: any): obj is string => isType(obj, 'String');
export const isNumber = (obj?: any): obj is number => isType(obj, 'Number');
export const isInteger = (obj?: any): obj is number => isType(obj, 'BigInt');
export const isObject = <T>(obj?: T): obj is T => isType(obj, 'Object');
export const isArray = (obj?: any): obj is any[] => isType(obj, 'Array');
export const isNull = (obj?: any): obj is null => isType(obj, 'Null');
export const isFunction = (obj?: any): obj is Function => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
export const isPromise = <T>(obj?: any): obj is Promise<T> => isType(obj, 'Promise');
export const isUndefined = (obj?: any): obj is undefined => isType(obj, 'Undefined');

export type TString = string | string[];
export type TNumber = number | number[];