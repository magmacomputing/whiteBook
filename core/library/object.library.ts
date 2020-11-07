import firebase from 'firebase/app';
import { getType, isObject, isArray, isString, TString, isNull, isUndefined, isNullish } from '@library/type.library';

const regex = /(?<matchWord>.*)\[(?<matchIdx>.)\]$/;// a pattern to find array-references
const regDate = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$/;

/**
 * Get nested value,  
 * allow for array-references in <path>
 */
export const getPath = <T>(obj: any, path: TString, dflt?: any, indx?: string | number): T => {
	if (!isObject(obj) && !isArray(obj))
		return dflt || undefined;
	if (isNullish(obj))
		return dflt || undefined;

	const [word, ...rest] = isString(path)						// first word in the index-path, and the rest
		? path.replace(' ', '').split('.')							// remove readability-spaces
		: path

	const match = regex.exec(word);										// eg. does the 'word' end in "*[0]"?
	const { matchWord, matchIdx } = !isNull(match) && match.groups || { matchWord: word, matchIdx: '*' };

	let clone = isArray(obj)
		? obj
			.map(itm => { if (isUndefined(itm[matchWord])) itm[matchWord] = dflt; return itm; })
			.map(itm => itm[matchWord])
			.filter((_row, idx) => indx === '*' || indx === idx.toString())
		: obj[matchWord]
	if (isArray(clone) && matchIdx !== '*')
		clone = clone[0];																// limit to the first filtered element

	return rest.length
		? getPath(clone, rest, dflt, matchIdx)					// recurse into object
		: clone || dflt
}

export const lowerObj = <T>(obj: T) => Object
	.keys(obj)
	.reduce((acc, key) => ((acc as any)[key.toLowerCase()] = (obj as any)[key], acc), {} as typeof obj);

export const sortObj = <T extends Record<string, any>>(obj: T): T | T[] => {
	if (getType(obj) === 'Object') {
		return Object.keys(obj)
			.sort((a, b) => Number(a.toLowerCase() > b.toLowerCase()))
			.reduce((result: Record<string, any>, key: string) => {
				result[key] = obj[key];

				if (Array.isArray(result[key]))
					result[key] = result[key].map((obj: any) => sortObj(obj));

				return result as T;
			}, {} as T)
	} else if (Array.isArray(obj)) {
		return obj.map(obj => sortObj(obj));
	} else {
		return obj;
	}
}

/**
 * I like the idea of passing a value=\<undefined> in a Firestore document to indicate an update should delete a field from the back-end.  
 * This is cleaner than adding FieldValue.delete() as an allowable type on every field.  
 * JSON.stringify.replacer will stash these fields with a substitute value, and  
 * JSON.parse.reviver will replace the substitute with firestore.FieldValue.delete()
 */
export const cloneObj = <T>(obj: T, subst?: any): T => {
	try {
		const str = JSON.stringify(obj, subst && replacer(subst));
		return JSON.parse(str, subst && reviver());
	} catch (err) {
		return obj;																							// return original object, if cannot parse
	}
}

const replacer = function (subst: any) {
	return function (key: string, value: any) {
		if (typeof value === 'function')
			value = value.toString();

		return typeof value !== 'undefined'
			? typeof value === 'function'
				? value.toString()
				: value
			: typeof subst === 'function'
				? subst.toString()
				: JSON.stringify(value)
	}
}
const reviver = function () {
	return function (key: string, value: any) {
		if (typeof value === 'string' && /^function\(\)\{return .+FieldValue\..+}$/.test(value)) {
			const method = value.split('.')[1].split('"')[0] as 'delete' | 'serverTimestamp';
			return firebase.firestore.FieldValue[method];
		}
		else return value;
	}
}

export const quoteObj = (obj: any) => {
	return JSON.stringify(obj)
		?.replace(/"([^"]+)":/g, '$1: ')
		?.replace(/,/g, ', ')
}

/** deep-compare Objects for equality */
export const isEqual = (obj1: any, obj2: any): boolean => {
	Object.keys(obj1).forEach(field => {
		if (!isObject(obj1[field]) && !isArray(obj1[field]) && obj1[field] !== obj2[field])
			console.log('change: <', field, '> ', obj2[field], ' => ', obj1[field]);
	})

	return Object.keys(obj1).every(field => {
		switch (getType(obj1[field])) {             // recurse if sub-object/-array
			case 'Object':
				return isEqual(obj1[field], obj2[field] || {});
			case 'Array':
				return isEqual(obj1[field], obj2[field] || []);
			default:
				return obj1[field] === obj2[field];
		}
	})
}

export const pluck = <T, K extends keyof T>(objs: T[], key: K): T[K][] =>
	objs.map(obj => obj[key]);
