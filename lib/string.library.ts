import { format } from 'util';
import { isString, isObject } from '@lib/type.library';

// General <string> functions

export const toProperCase = (...str: string[]): string =>
	str
		.map(text => text.replace(/\w\S*/g,
			word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()))
		.join(' ')

export const isNumeric = (str: any): str is number =>
	!isNaN(parseFloat(str)) && isFinite(str);

export const toNumeric = (str: string | number, stripZero: boolean = false) =>
	isNumeric(str) && (!str.toString().startsWith('0') || stripZero)
		? parseInt(str.toString(), 10)
		: str

export const asNumber = (str: string | number) =>
	isNumeric(str)
		? parseInt(str.toString(), 10)
		: NaN

export const randomString = (len = 36) =>
	Math.random().toString(len).substring(2, 15) + Math.random().toString(len).substring(2, 15);


/**
 * use sprintf-style formatting on a string.  
 * if the format does not contain a corresponding '%'-char, then de-construct the arguments
 */
export const sprintf = (fmt: any, ...msg: any[]) => {
	if (isString(fmt) && !fmt.includes('%')) {
		msg.unshift(fmt);						// put the format into the msg array
		fmt = msg     							// and build a new format string
			.map(arg => isObject(arg) ? '%j' : '%s')
			.join(', ')								// re-assemble as a comma-separated string
	}

	return format(fmt, ...msg);		// NodeJS.format()
}

/** make an Object's values into a Template Literals, and evaluate */
export const makeTemplate = (templateString: Object) =>
	(templateData: Object) =>
		new Function(`{${Object.keys(templateData).join(',')}}`, 'return `' + templateString + '`')(templateData);

/** make a Template Literal from a string */
export const asTemplate = (templateString: string) =>
	() =>
		new Function('return `' + templateString + '`;')();

// export const asString = (str: any = '') => isString(str) ? str : JSON.stringify(str);
export const asString = (str: any = '') => isString(str) ? str : (str.toString ? str.toString() : JSON.stringify(str));
export const toLower = (str: string) => isString(str) ? str.toLowerCase() : str;
export const toUpper = (str: string) => isString(str) ? str.toUpperCase() : str;