import { getType, isObject, isArray, isString, TString, isNull, isUndefined, nullToZero, isDate } from '@lib/type.library';

const regex = /(?<matchWord>.*)\[(?<matchIdx>.)\]$/;// a pattern to find array-references
export type TObject = { [key: string]: any; };
/**
 * Get nested value,  
 * allow for array-references in <path>
 */
export const getPath = <T>(obj: any, path: TString, dflt?: any, indx?: string | number): T | undefined => {
	if (!isObject(obj) && !isArray(obj))
		return dflt || undefined;
	if (isUndefined(obj))
		return dflt || undefined;

	const [word, ...rest] = isString(path)						// first word in the index-path, and the rest
		? path.replace(' ', '').split('.')							// remove readability-spaces
		: path

	const match = regex.exec(word);										// eg. does the 'word' end in "*[0]"?
	const { matchWord, matchIdx } = !isNull(match) && match.groups || { matchWord: word, matchIdx: '*' };

	obj = isArray(obj)
		? obj
			.map(itm => { if (isUndefined(itm[matchWord])) itm[matchWord] = dflt; return itm; })
			.map(itm => itm[matchWord])
			.filter((_row, idx) => indx === '*' || indx === idx.toString())
		: obj[matchWord]
	if (isArray(obj) && matchIdx !== '*')
		obj = obj[0];																		// limit to the first filtered element

	return rest.length
		? getPath(obj, rest, dflt, matchIdx)						// recurse into object
		: obj || dflt
}

/** sort Object by multiple keys */
export const sortKeys = (...keys: string[]): any => (a: TObject, b: TObject) => {
	const desc = keys.length ? (keys[0].startsWith('-')) : false;
	const key = desc ? keys[0].substring(1) : keys[0];// take out the first key

	switch (true) {
		case keys.length === 0:
			return 0;

		case nullToZero(a?.[key]) < nullToZero(b?.[key]) && !desc:
		case nullToZero(a?.[key]) > nullToZero(b?.[key]) && desc:
			return -1;

		case nullToZero(a?.[key]) < nullToZero(b?.[key]) && desc:
		case nullToZero(a?.[key]) > nullToZero(b?.[key]) && !desc:
			return 1;

		default:
			return sortKeys(...keys.slice(1))(a, b);		// recurse into keys
	}
}

/** deep-clone Object */
export const cloneObj = <T>(obj: T) => {
	const clone = parseObj<T>(JSON.stringify(obj));	// beware: JSON.stringify will drop all <undefined> key:value

	return isNull(clone)
		? obj																					// return original object, if cannot parse
		: clone
}

export const ifObject = <T>(str: string | null) =>
	(isString(str) && str.startsWith('{') && str.endsWith('}'))
		? JSON.parse(str)
		: str

const parseObj = <T>(str?: string | null) => {
	if (!isString(str))
		return {} as T;

	try {
		return JSON.parse(str) as T
	} catch {
		return null;
	}
}

export const deepClone = (obj: any): any => {
	if (isNull(obj))
		return obj;

	if (isArray(obj))
		return obj.map(deepClone);

	if (isDate(obj))
		return new Date(obj);

	if (!isObject(obj))
		return obj;

	const res: { [key: string]: any } = {};
	Object.entries<any>(obj)
		.forEach(([key, val]) => res[key] = deepClone(val));						// recurse into Object
	return res;
}

/** deep-compare Objects for equality */
export const equalObj = (obj1: any, obj2: any): boolean => {
	Object.keys(obj1).forEach(field => {
		if (!isObject(obj1[field]) && !isArray(obj1[field]) && obj1[field] != obj2[field])
			console.log('change: <', field, '> ', obj2[field], ' => ', obj1[field]);
	})

	return Object.keys(obj1).every(field => {
		switch (getType(obj1[field])) {             // recurse if sub-object/-array
			case 'Object':
				return equalObj(obj1[field], obj2[field] || {});
			case 'Array':
				return equalObj(obj1[field], obj2[field] || []);
			default:
				return obj1[field] == obj2[field];
		}
	})
}

export const isEmpty = <T>(obj: T | T[]): boolean =>
	(isObject(obj) && Object.keys(obj).length === 0) ||
	(isArray(obj) && obj.length === 0)
