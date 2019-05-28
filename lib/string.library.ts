import { isString } from '@lib/type.library';

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