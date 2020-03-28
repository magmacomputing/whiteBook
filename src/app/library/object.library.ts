import { getType, isObject, isArray, isString, TString, isNull, isUndefined, nullToZero, TObject } from '@library/type.library';
import { isNumeric } from '@library/string.library';

/**
 * Get nested value,  
 * allow for array-references in <path>
 */
const regex = /(?<matchWord>.*)\[(?<matchIdx>.)\]$/;// a pattern to find array-references
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
export const sortKeys = (...keys: string[]): any => (a: TObject<any>, b: TObject<any>) => {
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

/** lowerCase Object keys */
export const lowerObj = (obj: any) => {
	let newObj: TObject<any>;

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

/** Convert Array[{}] to Object{{}} */
export const objArray = (obj: any) => {
	if (isArray(obj) && isObject(obj[0])) {
		const newObj: TObject<any> = {};

		obj.forEach(itm =>
			Object.keys(itm)
				.forEach(key => newObj[key] = itm[key])
		)
		return newObj;
	}
	else return obj;
}

/** Sort Object by its keys */
export const sortObj = (obj: any, deep: boolean = true): any => {
	const col: TObject<any> = {};

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
						col[key] = new Date();
						// col[key].setTime(obj[key].getTime());
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
