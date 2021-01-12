import { getType, isString, isObject, assertCondition, assertString, isNullish } from '@library/type.library';

// Prototype extensions

declare global {
	interface String {
		// remove redundant spaces from a string
		trimAll(): string;
	}
}

if (!String.prototype.hasOwnProperty('trimAll')) {
	Object.defineProperty(String.prototype, 'trimAll', {
		enumerable: false,
		configurable: false,
		writable: false,
		value: function () {
			return this.replace(/\s+/g, ' ').trim();
		}
	})
}

// General <string> functions

export const toProperCase = <T extends string>(...str: T[]) =>
	str
		.map(text => text.replace(/\w\S*/g,
			word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()))
		.join(' ') as T

export const toCamelCase = <T extends string>(sentence: T) => {
	let [word, ...rest] = sentence.match(/[A-Z\xC0-\xD6\xD8-\xDE]?[a-z\xDF-\xF6\xF8-\xFF]+|[A-Z\xC0-\xD6\xD8-\xDE]+(?![a-z\xDF-\xF6\xF8-\xFF])|\d+/g) ?? [];

	if (isNumeric(word)) {
		word = rest[0];
		rest.splice(0, 1);
	}

	return (sentence.startsWith('_') ? '_' : '') + word.toLowerCase() + toProperCase(...rest).replace(/ /g, '') as T;
}

export const randomString = (len = 36) =>
	strlen(Math.random().toString(len).substring(2, 15) + Math.random().toString(len).substring(2, 15), 30);

/**
 * use sprintf-style formatting on a string.  
 * if the format does not contain a corresponding '${digit}' then re-construct the parameters
 */
export const sprintf = (fmt: any, ...msg: any[]) => {
	let sfmt: string = asString(fmt);			// avoid mutate fmt
	let regexp = /\$\{(\d)\}/g;						// pattern to find "${digit}" parameter markers

	if (!isString(fmt)) {									// might be an Object
		msg.unshift(JSON.stringify(fmt));		// push to start of msg[]
		sfmt = '';													// reset the string-format
	}

	let cnt = 0;													// flip all the %s or %j to a ${digit} parameter
	sfmt = sfmt.replace(/%[sj]/g, _ => `\${${cnt++}}`);

	const params = Array.from(sfmt.matchAll(regexp))
		.map(match => Number(match[1]))			// which parameters are in the fmt
	msg.forEach((_, idx) => {
		if (!params.includes(idx))					// if more args than params
			sfmt += `${sfmt.length === 0 ? '' : ', '}\${${idx}}`						//  append a dummy params to fmt
	})

	return sfmt.replace(regexp, (_, idx) => isObject(msg[idx]) ? JSON.stringify(msg[idx]) : msg[idx]);
}

export const plural = (val: string | number | Record<string, string>, word: string, plural = word + 's') => {
	const _plural = (num: string | number | object, word: string, plural = word + 's') =>
		[1, -1].includes(Number(num)) ? word : plural;

	return isObject(val)
		? (num: string, word: string) => _plural(num, word, (val as Record<string, string>)[word])
		: _plural(val, word, plural)
}

/** make an Object's values into a Template Literals, and evaluate */
export const makeTemplate = (templateString: Object) =>
	(templateData: Object) =>
		new Function(`{${Object.keys(templateData).join(',')}}`, 'return `' + templateString + '`')(templateData);

export const asString = (str: any) => isString(str) ? str.trim() : (str?.toString ? str.toString() : JSON.stringify(str))?.trim();
export const asNumber = (str?: string | number) => parseFloat(str?.toString() ?? 'NaN');
export const toLower = (str: string) => isString(str) ? str.toLowerCase().trim() : str;
export const toUpper = (str: string) => isString(str) ? str.toUpperCase().trim() : str;

export const isNumeric = (str?: string | number): str is number => !isNaN(asNumber(str)) && isFinite(str as number);
export const ifNumeric = (str?: string | number, stripZero = false) =>
	isNumeric(str) && (!str.toString().startsWith('0') || stripZero)
		? asNumber(str)
		: str

export const padString = (str: string | number, pad = 6) => (isNumeric(str) ? str.toFixed(2).toString() : str ?? '').padStart(pad, '\u007F');

type StrLen<Min, Max = Min> = string & { __value__: never };
export const strlen = <Min extends number, Max extends number>(str: unknown, min: Min, max?: Max) => {
	assertString(str);
	assertCondition(str.length >= min && str.length <= (max ?? min), 'string length is not between specified min and max')

	return str as StrLen<Min, Max>;
}

export const stringify = (obj: any) => {
	const type = getType(obj);
	let val = `${type}:`;

	switch (type) {
		case 'Object':
		case 'Array':
			return JSON.stringify(obj);

		case 'String':											// return as-is
			return obj;

		case 'Number':
		case 'BigInt':
			return obj.toString();

		case 'Map':													// special treatment
			val += JSON.stringify(Array.from((obj as any).entries()));
			return val;

		case 'Set':													// special treatment
			val += JSON.stringify(Array.from((obj as any).keys()));
			return val;

		default:
			val += obj as string;
			return val;
	}
}

export const objectify = <T>(str: T | null) => {
	const val = isString(str) ? str.trim() : '';								// easier to work with trimmed string
	const pos = val.indexOf(':') + 1;

	switch (true) {
		case val.startsWith('{"') && val.endsWith('}'):
		case val.startsWith('[') && val.endsWith(']'):
		case val === '{}':
			return JSON.parse(val) as T;

		case val.startsWith('Object:{"') && val.endsWith('}'):
		case val.startsWith('Array:[') && val.endsWith(']'):
			return JSON.parse(val.substring(pos)) as T;

		case val.startsWith('Map:[[') && val.endsWith(']]'):
			return new Map(JSON.parse(val.substring(pos))) as Map<any, T>;

		case val.startsWith('Set:["') && val.endsWith('"]'):
			return new Set(JSON.parse(val.substring(pos))) as Set<T>;

		case val.startsWith('Date:"') && val.endsWith('"'):
			return new Date(JSON.parse(val.substring(pos)));

		case isNullish(str):
		case val === '':
			return null;

		default:
			return ifNumeric(str as unknown as string);
	}
}