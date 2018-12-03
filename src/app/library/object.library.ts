import { isNumeric } from '@lib/string.library';
import { isObject, getType, isArray, isString, TString, isNull } from '@lib/type.library';
import { isUndefined } from 'util';

export interface IObject<T> { [key: string]: T; }

/** Get nested value, allow for array-references in <path> */
export const getPathX = <T>(obj: { [key: string]: any }, path: string, dflt?: any) => {
	if (!isObject(obj))
		return undefined;

	let res = obj;
	// let sub = obj;																	// reference to parent object

	path.split('.')
		.forEach(part => {
			part = part.replace(' ', '');               // remove <spaces> (added for readability)

			if (part.substring(part.length - 1) === ']') {
				const ref = part.split('[');
				const idx = ref[1].replace(']', '');

				if (res && res[ref[0]]) {
					res = idx === '*'
						? res[ref[0]]                         // entire array
						: res[ref[0]][idx]                    // else single element from array
				}
			} else {
				// if (isArray(res)) {
				// 	res = res.map((item, idx) => {
				// 		let val = item[part];
				// 		if (isUndefined(val) && dflt) {
				// 			val = dflt;
				// 			sub[idx] = dflt;
				// 		}
				// 		else res = res && res[part];
				// 	})
				// }
				res = isArray(res)
					? res.map(item => item[part])
					: (res && res[part] || undefined)
			}
		})
	return res;
}

export const getPath = (obj: any, path: TString, dflt?: any, indx?: string | number): any => {
	if (!isObject(obj) && !isArray(obj))
		return dflt || undefined;
	if (isUndefined(obj))
		return dflt || undefined;

	const [word, ...rest] = isString(path)						// first word in the index-path, and the rest
		? path.replace(' ', '').split('.')							// remove readability-spaces
		: path

	const regex = /(?<matchWord>.*)\[(?<matchIdx>.)\]$/;		// a pattern to find array-references
	const match = regex.exec(word);										// eg. does the 'word' end in "*[0]"?
	const { matchWord, matchIdx } = !isNull(match) && match.groups || { matchWord: word, matchIdx: '*' };

	obj = isArray(obj)
		? obj
			.map(itm => { if (isUndefined(itm[matchWord])) itm[matchWord] = dflt; return itm; })
			.map(itm => itm[matchWord])
			.filter((_row, idx) => indx === '*' || indx === idx.toString())
		: obj[matchWord]

	return rest.length
		? getPath(obj, rest, dflt, matchIdx)						// recurse into object
		: obj || dflt
}

/** Sort Object by its keys */
export const sortObj = (obj: any, deep: boolean = true): any => {
	const col: IObject<any> = {};

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

					case 'Array':
						col[key] = obj[key].every(isNumeric)
							? obj[key].sort((a: number, b: number) => a - b)
							: obj[key].sort()                   // sort Array    
						break;

					case 'Date':
						col[key] = new Date();
						col[key].setTime(obj[key].getTime());
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

/** sort Object by multiple keys */
export const sortKeys = (...keys: any[]): any => (a: any, b: any) => {
	const key = keys[0];														// take out the first key
	switch (true) {
		case keys.length === 0:
			return 0;
		case a[key] < b[key]:
			return -1;
		case a[key] > b[key]:
			return 1;
		default:
			return sortKeys(...keys.slice(1))(a, b);
	}
}

/** lowerCase Object keys */
export const lowerObj = (obj: any) => {
	if (!isObject(obj))
		return obj;

	let newObj: IObject<any>;
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
		const newObj: IObject<any> = {};

		obj.forEach(itm =>
			Object.keys(itm)
				.forEach(key => newObj[key] = itm[key])
		)
		return newObj;
	}
	else return obj;
}

/** deep-clone Object */
export const cloneObj = <T>(obj: T): T => {
	try {
		return JSON.parse(JSON.stringify(obj))
	} catch (e) {
		return obj;
	}
};

export const deepClone = (obj: any): any => {
	const type = getType(obj);

	if (isArray(obj))
		return obj.map(deepClone);

	if (!isObject(obj))
		return obj;

	return Object.keys(obj).map(itm => deepClone(obj[itm]));
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

export const isEmpty = (obj: object | any[]): boolean =>
	(isObject(obj) && Object.keys(obj).length === 0) ||
	(isArray(obj) && obj.length === 0)
