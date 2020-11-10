import firebase from 'firebase/app';

import { isObject, isArray, isString, TString, isNull, isUndefined, isNullish, isReference, getType } from '@library/type.library';

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
	const keys1 = obj1?.keys ? Array.from<string>(obj1.keys()) : Object.keys(obj1);
	const keys2 = obj2?.keys ? Array.from<string>(obj2.keys()) : Object.keys(obj2);
	const keys = new Set<string>();

	keys1.forEach(key => keys.add(key));
	keys2.forEach(key => keys.add(key));

	return Array.from(keys).every(key => {
		const val1 = obj1[key];
		const val2 = obj2[key];

		if (!isReference(val1) && val1 !== val2)
			console.log('change: <', key, '> ', val1, ' => ', val2);
		return isReference(val1) && isReference(val2)
			? isEqual(val1, val2)											// recurse into object
			: val1 === val2
	})

	// return Array.from(keys).every(key => {
	// 	switch (getType(obj1[key])) {             	// recurse if sub-object/-array
	// 		case 'Object':
	// 			return isEqual(obj1[key], obj2[key] || {});
	// 		case 'Array':
	// 			return isEqual(obj1[key], obj2[key] || []);
	// 		default:
	// 			return obj1[key] === obj2[key];
	// 	}
	// })
}

export const pluck = <T, K extends keyof T>(objs: T[], key: K): T[K][] =>
	objs.map(obj => obj[key]);
