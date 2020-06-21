import { isIterable, isNullish, isNumber } from '@library/type.library';
import { asString } from './string.library';

export const asArray = <T>(arr: T | Iterable<T> = []) => isIterable<T>(arr) ? [...arr] : (isNullish(arr) || (arr as unknown as string) === '' ? [] : [arr]);

// insert a value into an array by its sorted position
export const sortInsert = <T>(arr: T[], val: T) => {
	let low = 0, high = arr.length;
	let clone = asArray(arr);

	while (low < high) {
		const mid = (low + high) >>> 1;				// divide by 2
		if (clone[mid] < val)
			low = mid + 1
		else high = mid
	}

	clone.splice(low, 0, val);
	return clone;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~``
declare global {
	interface Array<T> {
		/** return reduced Array-of-Objects as keyed-Object-of-Arrays */
		groupBy<K extends string>(key: string): Record<K, T>;

		/** return sorted Array-of-objects */
		orderBy(keys: string | string[]): T[];
		/** return sorted Array-of-objects */
		sortBy(keys: string | string[]): T[];

		/** return new Array with no repeated elements */
		distinct(): T[];
		/** return mapped Array with no repeated elements */
		distinct<S>(mapfn: (value: T, index: number, array: T[]) => S, thisArg?: any): S[];

		/** Clear down an Array (default to 'empty') */
		truncate(base?: number): T[];

		/** return cartesian-product of Array of Arrays */
		cartesian(): T;
		cartesian(...args: T[][]): T[];
	}
}

if (!Array.prototype.hasOwnProperty('groupBy')) {
	Array.prototype.groupBy = function (key = 'key' as any) {
		return this.reduce((acc, row) => { acc[row[key]] = row; return acc; }, {});
	}
}

if (!Array.prototype.hasOwnProperty('orderBy')) {
	Array.prototype.orderBy = function (keys) {
		return this.sort((a, b) => {
			let result = 0;

			asArray(keys).forEach(key => {
				const dir = key.startsWith('-') ? -1 : 1;
				if (dir === -1) key = key.substring(1);

				if (result === 0) {
					result = isNumber(a[key]) && isNumber(b[key])
						? dir * (a[key] - b[key])
						: dir * asString(a[key]).localeCompare(asString(b[key]));
				}
			})

			return result;
		})
	}
	Array.prototype.sortBy = Array.prototype.orderBy;
}

if (!Array.prototype.hasOwnProperty('truncate')) {
	Array.prototype.truncate = function (base = 0) {
		this.length === base;
		return this;
	}
}

if (!Array.prototype.hasOwnProperty('distinct')) {
	Array.prototype.distinct = function (selector?: (value: any, index: number, array: any[]) => []) {
		return selector
			? this.map(selector).distinct()
			: asArray(new Set(this))
	}
}

if (!Array.prototype.hasOwnProperty('cartesian')) {
	Array.prototype.cartesian = function (...args: any[]) {
		const [a, b = [], ...c] = args.length === 0 ? this : args;
		const cartFn = (a: any[], b: any[]) => (<any[]>[]).concat(...a.map(d => b.map(e => (<any[]>[]).concat(d, e))));

		return b.length
			? this.cartesian(cartFn(a, b), ...c)
			: asArray(a || [])
	}
}
