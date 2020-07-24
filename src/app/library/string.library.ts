import { format } from 'util';
import { isString, isObject, assertCondition, assertString } from '@library/type.library';

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
		? (num: string, word: string) => _plural(num, word, val[word])
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

export const asString = (str: any = '') => isString(str) ? str : (str.toString ? str.toString() : JSON.stringify(str)) as string;
export const asNumber = (str: string | number) => isNumeric(str) ? parseInt(str.toString(), 10) : NaN;
export const padString = (str: string | number | undefined, pad = 6) => (isNumeric(str) ? str.toFixed(2).toString() : str ?? '').padStart(pad, '\u007F');

export const isNumeric = (str: any): str is number => !isNaN(parseFloat(str)) && isFinite(str);
export const toNumeric = (str: string | number, stripZero: boolean = false) =>
	isNumeric(str) && (!str.toString().startsWith('0') || stripZero) ? parseInt(str.toString(), 10) : str;

export const toLower = (str: string) => isString(str) ? str.toLowerCase() : str;
export const toUpper = (str: string) => isString(str) ? str.toUpperCase() : str;
export const toTitle = (str: string) => str
	.toLowerCase()
	.replace(/(^|\s)(\w)/g, (match, prev, letter) => prev + letter.toUpperCase())
	.replace(/:\s*(\w)/g, letter => letter.toUpperCase())
export const toCamel = (str: string) => {
	const words = str.match(/[A-Z\xC0-\xD6\xD8-\xDE]?[a-z\xDF-\xF6\xF8-\xFF]+|[A-Z\xC0-\xD6\xD8-\xDE]+(?![a-z\xDF-\xF6\xF8-\xFF])|\d+/g);
	return words === null
		? null
		: words[0].toLowerCase() + words.slice(1).map(toTitle).join('');
}

type StrLen<Min, Max = Min> = string & { __value__: never };
export const strlen = <Min extends number, Max extends number>(str: unknown, min: Min, max?: Max) => {
	assertString(str);
	assertCondition(str.length >= min && str.length <= (max ?? min), 'string length is not between specified min and max')

	return str as StrLen<Min, Max>;
}
