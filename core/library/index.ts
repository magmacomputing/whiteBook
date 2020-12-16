import * as libType from './type.library';

/**
 * Barrel for general library functions / classes / types
 */
export { getType, isType, asType, isIterable, isNullish } from '@library/type.library';
export { isPrimitive, isReference } from '@library/type.library';
export { isString, isNumber, isInteger, isBoolean, isArray, isObject, isNull, isUndefined, isDefined } from '@library/type.library';
export { isDate, isFunction, isClass, isPromise } from '@library/type.library';
export { nullToZero, nullToEmpty, nullToValue, isEmpty } from '@library/type.library';

export type TString = libType.TString;
export type TNumber = libType.TNumber;
export type valueOf<T> = libType.valueOf<T>;

export { toProperCase, toCamelCase, isNumeric, ifNumeric, asNumber, asString } from '@library/string.library';
export { sprintf, randomString, makeTemplate } from '@library/string.library';
export { toLower, toUpper, stringify, objectify } from '@library/string.library';

export { asArray, sortInsert, sortBy } from '@library/array.library';
export { toHex, suffix, fix } from '@library/number.library';
export { getPath, cloneObj } from '@library/object.library';
export { dbg, lprintf } from '@library/logger.library';
export { WebStore, alert, prompt } from '@library/browser.library';
export { Cipher } from '@library/cipher.library';
export { Pledge } from '@library/utility.library';
