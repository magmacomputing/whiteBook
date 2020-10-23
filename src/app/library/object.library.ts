import { getType, isObject, isArray, isString, TString, isNull, isUndefined } from '@library/type.library';

/**
 * Get nested value,  
 * allow for array-references in <path>
 */
export const getPath = <T>(obj: any, path: TString, dflt?: any, indx?: string | number): T | undefined => {
	if (!isObject(obj) && !isArray(obj))
		return dflt || undefined;
	if (isUndefined(obj))
		return dflt || undefined;
	let clone = cloneObj(obj);

	const [word, ...rest] = isString(path)						// first word in the index-path, and the rest
		? path.replace(' ', '').split('.')							// remove readability-spaces
		: path

	const regex = /(?<matchWord>.*)\[(?<matchIdx>.)\]$/;// a pattern to find array-references
	const match = regex.exec(word);										// eg. does the 'word' end in "*[0]"?
	const { matchWord, matchIdx } = !isNull(match) && match.groups || { matchWord: word, matchIdx: '*' };

	clone = isArray<Record<string, any>>(clone)
		? clone
			.map(itm => { if (isUndefined(itm[matchWord])) itm[matchWord] = dflt; return itm; })
			.map(itm => itm[matchWord])
			.filter((_row, idx) => indx === '*' || indx === idx.toString())
		: clone[matchWord]
	if (isArray(clone) && matchIdx !== '*')
		clone = clone[0];																// limit to the first filtered element

	return rest.length
		? getPath(clone, rest, dflt, matchIdx)					// recurse into object
		: clone || dflt
}

/** deep-clone Object */
export const cloneObj = <T>(obj: T) => {
	let clone: T | null = null;

	try {
		const str = JSON.stringify(obj);							// beware: JSON.stringify will drop all <undefined> key:value
		clone = JSON.parse(str)
	} catch {
		clone = null;
	}

	return clone ?? obj;														// return original object, if cannot parse
}

export const quoteObj = (obj: any) => {
	return JSON.stringify(obj)
		?.replace(/"([^"]+)":/g, '$1: ')
		?.replace(/,/g, ', ')
}

/** deep-compare Objects for equality */
export const isEqual = (obj1: any, obj2: any): boolean => {
	Object.keys(obj1).forEach(field => {
		if (!isObject(obj1[field]) && !isArray(obj1[field]) && obj1[field] != obj2[field])
			console.log('change: <', field, '> ', obj2[field], ' => ', obj1[field]);
	})

	return Object.keys(obj1).every(field => {
		switch (getType(obj1[field])) {             // recurse if sub-object/-array
			case 'Object':
				return isEqual(obj1[field], obj2[field] || {});
			case 'Array':
				return isEqual(obj1[field], obj2[field] || []);
			default:
				return obj1[field] == obj2[field];
		}
	})
}

export const pluck = <T, K extends keyof T>(objs: T[], key: K): T[K][] =>
	objs.map(obj => obj[key]);
