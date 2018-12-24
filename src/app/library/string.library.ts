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
	isNumeric(str) && (str.toString().substring(0, 1) !== '0' || stripZero)
		? parseInt(str.toString(), 10)
		: str

/** make a String into a Template Literal, and evaluate */
export const makeTemplate = (templateString: Object) =>
	(templateData: Object) =>
		new Function(`{${Object.keys(templateData).join(',')}}`, 'return `' + templateString + '`')(templateData);

export const asString = (str: any = '') => isString(str) ? str : JSON.stringify(str);
export const toLower = (str: string) => isString(str) ? str.toLowerCase() : str;
export const toUpper = (str: string) => isString(str) ? str.toUpperCase() : str;