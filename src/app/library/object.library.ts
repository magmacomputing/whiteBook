import { getType, isObject, isArray, isString, TString, isNull, isUndefined, nullToZero } from '@library/type.library';
import { isNumeric } from '@library/string.library';

const getPath1 = <T>(obj: any, str: string, dflt?: any) => {
	if (!isObject<T>(obj) && !isArray<T>(obj))
		return dflt;
	if (isUndefined(obj))
		return dflt;

	let clone = JSON.parse(JSON.stringify(obj));
	const a = str
		.replace(/\[(\w+)\]/g, '.$1')										// convert indexes to properties
		.replace(/^\./, '')															// strip a leading dot
		.split('.');

	for (var i = 0, n = a.length; i < n; ++i) {
		var k = a[i];
		if (k in clone) {
			clone = clone[k];
		} else {
			return;
		}
	}
	return clone;
}

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

/** sort Object by multiple keys */
export const sortKeys = (...keys: string[]): any => (a: Record<string, any>, b: Record<string, any>) => {
	const desc = keys.length ? (keys[0].startsWith('-')) : false;
	const key = desc ? keys[0].substring(1) : keys[0];// take out the first key

	switch (true) {
		case keys.length === 0:
			return 0;

		case nullToZero(getPath(a, key)) < nullToZero(getPath(b, key)) && !desc:
		case nullToZero(getPath(a, key)) > nullToZero(getPath(b, key)) && desc:
			return -1;

		case nullToZero(getPath(a, key)) < nullToZero(getPath(b, key)) && desc:
		case nullToZero(getPath(a, key)) > nullToZero(getPath(b, key)) && !desc:
			return 1;

		default:
			return sortKeys(...keys.slice(1))(a, b);		// recurse into keys
	}
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

/** lowerCase Object keys */
export const lowerObj = (obj: any) => {
	let newObj: Record<string, any>;

	if (!isObject(obj))
		return obj;

	switch (getType(obj)) {
		case 'Object':
			newObj = {};
			Object.keys(obj).forEach(key => newObj[key.toLowerCase()] = lowerObj(obj[key]));
			break;

		case 'Array':
			newObj = obj.map((key: any, idx: number) => lowerObj(obj[idx]));
			break;

		default:
			newObj = obj;
			break;
	}

	return newObj;
}

/** Sort Object by its keys */
export const sortObj = (obj: any, deep: boolean = true): any => {
	const col: Record<string, any> = {};

	if (!isObject(obj))
		return obj;

	return Object.keys(obj)
		.sort()
		.reduce((col, key) => {
			const type = getType(obj[key]);
			if (deep && type !== 'Null' && type !== 'Undefined') {
				switch (type) {
					case 'Object':
						col[key] = sortObj(obj[key], deep);   // recurse
						break;

					case 'Array':														// TODO:  check isIterable()
						col[key] = obj[key].every(isNumeric)
							? obj[key].sort((a: number, b: number) => a - b)
							: obj[key].sort()                   // sort Array    
						break;

					case 'Date':
						col[key] = new Date(obj[key]);
						break;

					default:
						col[key] = obj[key];
						break;
				}
			}
			else col[key] = obj[key];
			return col;
		}, col);
};

export const ifObject = <T>(str: string | null) =>
	(isString(str) && str.startsWith('{') && str.endsWith('}'))
		? JSON.parse(str) as T
		: str

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
