import { format } from 'util';
import { isString, isObject, assertCondition, assertString, isDate, getType } from '@library/type.library';
import { fmtInstant, Instant } from './instant.library';

// Prototype <string> extensions

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

export const toProperCase = (...str: string[]) =>
	str
		.map(text => text.replace(/\w\S*/g,
			word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()))
		.join(' ')

export const randomString = (len = 36) =>
	strlen(Math.random().toString(len).substring(2, 15) + Math.random().toString(len).substring(2, 15), 30);

/**
 * use sprintf-style formatting on a string.  
 * if the format does not contain a corresponding '%'-char, then de-construct the arguments
 */
export const sprintf = (fmt: any, ...msg: any[]) => {
	let sfmt = fmt;								// avoid mutate fmt
	if (isString(fmt) && !fmt.includes('%')) {
		msg.unshift(fmt);						// put the format into the msg array
		sfmt = msg     							// and build a new format string
			.map(arg => isObject(arg) ? '%j' : '%s')
			.join(', ')								// re-assemble as a comma-separated string
	}

	return format(sfmt, ...msg);	// NodeJS.format()
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

/** make a Template Literal from a string */
export const asTemplate = (templateString: string) =>
	() =>
		new Function('return `' + templateString + '`;')();

export const asString = (str: any = '') => isString(str) ? str.trim() : (str.toString ? str.toString() : JSON.stringify(str)) as string;
export const asNumber = (str: string | number) => parseFloat(str.toString());
export const padString = (str: string | number | undefined, pad = 6) => (isNumeric(str) ? str.toFixed(2).toString() : str ?? '').padStart(pad, '\u007F');

export const isNumeric = (str?: string | number): str is number => !isNaN(parseFloat(str as string)) && isFinite(str as number);
export const ifNumeric = (str: string | number, stripZero: boolean = false) =>
	isNumeric(str) && (!str.toString().startsWith('0') || stripZero) ? parseFloat(str.toString()) : str;

export const toLower = (str: string) => isString(str) ? str.toLowerCase() : str;
export const toUpper = (str: string) => isString(str) ? str.toUpperCase() : str;
export const toTitle = (str: string) => str
	.toLowerCase()
	.replace(/(^|\s)(\w)/g, (match, prev, letter) => prev + letter.toUpperCase())
	.replace(/:\s*(\w)/g, letter => letter.toUpperCase())
export const toCamel = <T extends string>(str: T) => {
	const words = str.match(/[A-Z\xC0-\xD6\xD8-\xDE]?[a-z\xDF-\xF6\xF8-\xFF]+|[A-Z\xC0-\xD6\xD8-\xDE]+(?![a-z\xDF-\xF6\xF8-\xFF])|\d+/g);
	return words === null
		? null
		: words[0].toLowerCase() + words.slice(1).map(toTitle).join('') as T;
}

type StrLen<Min, Max = Min> = string & { __value__: never };
export const strlen = <Min extends number, Max extends number>(str: unknown, min: Min, max?: Max) => {
	assertString(str);
	assertCondition(str.length >= min && str.length <= (max ?? min), 'string length is not between specified min and max')

	return str as StrLen<Min, Max>;
}

export const stringify = (obj: any) => {
	let val = `${getType(obj)}:`;

	switch (getType(obj)) {
		case 'Object':
		case 'Array':
			return JSON.stringify(obj);

		case 'Map':													// special treatment
			return val += JSON.stringify(Array.from((obj as any).entries()));

		case 'Set':
			return val += JSON.stringify(Array.from((obj as any).keys()));

		default:
			return obj as string;
	}
}

export const objectify = <T>(str: T | null) => {
	const asString = isString(str);
	const val = (str as unknown as string).trim();								// easier to work with trimmed string

	switch (true) {
		case asString && val.startsWith('{"') && val.endsWith('}'):
		case asString && val.startsWith('[') && val.endsWith(']'):
		case asString && val === '{}':
			return JSON.parse(val) as T;

		case asString && val.startsWith('Object:{"') && val.endsWith('}'):
		case asString && val.startsWith('Array:[') && val.endsWith(']'):
			const pos = val.indexOf(':') + 1;
			return JSON.parse(val.substring(pos)) as T;

		case asString && val.startsWith('Map:[[') && val.endsWith(']]'):
			return new Map(JSON.parse(val?.substring(4))) as Map<any, T>;

		case asString && val.startsWith('Set:["') && val.endsWith('"]'):
			return new Set(JSON.parse(val.substring(4))) as Set<T>;

		case asString:
			return str as T;

		case isDate(str):
			return fmtInstant(Instant.FORMAT.dayTime, val) as unknown as T;

		default:
			return ifNumeric(val) as unknown as T;
	}
}