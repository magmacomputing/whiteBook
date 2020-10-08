import { isIterable, isNullish, isNumber, isBoolean, isString, nullToValue } from '@library/type.library';
import { asString } from './string.library';
import { getPath } from './object.library';

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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface ISortOption {
	field: string;
	default?: any;
	dir?: 'asc' | 'desc';
}
declare global {
	interface Array<T> {
		/** return reduced object[] as {key: object, ...} */
		groupBy<K extends string>(key: string): Record<K, T[]>;
		groupBy(...keys: string[]): Record<string, T[]>;
		groupBy<K extends string>(flatten: true, key: string): Record<K, T>;
		groupBy(flatten: true, ...keys: string[]): Record<string, T>;
		groupBy<K extends string>(flatten: false, key: string): Record<K, T[]>;
		groupBy(flatten: false, ...keys: string[]): Record<string, T[]>;

		/** return sorted Array-of-objects */
		orderBy(...keys: (string | string[] | ISortOption | ISortOption[])[]): T[];
		sortBy(...keys: (string | string[] | ISortOption | ISortOption[])[]): T[];

		/** return new Array with no repeated elements */
		distinct(): T[];
		/** return mapped Array with no repeated elements */
		distinct<S>(mapfn: (value: T, index: number, array: T[]) => S, thisArg?: any): S[];

		/** Clear down an Array (default to length=0) */
		truncate(base?: number): T[];

		/** return cartesian-product of Array of Arrays */
		cartesian(): T;
		cartesian(...args: T[][]): T[];
	}
}

if (!Array.prototype.hasOwnProperty('groupBy')) {
	Object.defineProperty(Array.prototype, 'groupBy', {
		configurable: false,
		enumerable: false,
		writable: false,
		value: function (...keys: string[] | [boolean, ...string[]]) {
			let flat = false;
			if (isBoolean(keys[0])) {
				flat = keys[0];
				keys.splice(0, 1);
			}

			return this.reduce(function (acc: Record<string, any>, row: Record<string, any>) {
				const group = (keys as string[])
					.map(key => getPath(row, key)).join(':');
				if (flat)
					acc[group] = row;															// only return latest match
				// else (acc[group] ??= []).push(row);					// return all matches in array
				else (acc[group] = acc[group] || []).push(row);	// TODO: until Typescript 4.0 supported
				return acc;
			}, {});
		}
	})
}

if (!Array.prototype.hasOwnProperty('orderBy')) {
	const obj = {
		configurable: false,
		enumerable: false,
		writable: false,
		value: function (...keys: (string | string[] | ISortOption | ISortOption[])[]) {
			const sortOptions = keys
				.flat()																										// flatten array-of-array
				.map(key => isString(key) ? { field: key } : key)					// re-write as SortOption object

			return (a: Record<string, any>, b: Record<string, any>) => {
				let result = 0;

				sortOptions.forEach(key => {
					if (result === 0) {																			// stop looking if result != 0
						const dir = key.dir === 'desc' ? -1 : 1;
						const valueA = getPath(a, key.field, nullToValue(key.default, 0));
						const valueB = getPath(b, key.field, nullToValue(key.default, 0));

						result = isNumber(valueA) && isNumber(valueB)
							? dir * (valueA - valueB)
							: dir * asString(valueA).localeCompare(asString(valueB));
					}
				})

				return result;
			}
		}
	} as PropertyDescriptor & ThisType<any[]>
	Object.defineProperty(Array.prototype, 'orderBy', obj);
	Object.defineProperty(Array.prototype, 'sortBy', obj);
}

if (!Array.prototype.hasOwnProperty('truncate')) {
	Object.defineProperty(Array.prototype, 'truncate', {
		configurable: false,
		enumerable: false,
		writable: false,
		value: function (base = 0) {
			this.fill(null, base).length = base;
			return this;
		}
	})
}

if (!Array.prototype.hasOwnProperty('distinct')) {
	Object.defineProperty(Array.prototype, 'distinct', {
		configurable: false,
		enumerable: false,
		writable: false,
		value: function (selector: (value: any, index: number, array: any[]) => []) {
			return selector
				? this.map(selector).distinct()
				: asArray(new Set(this))
		}
	})
}

if (!Array.prototype.hasOwnProperty('cartesian')) {
	Object.defineProperty(Array.prototype, 'cartesian', {
		configurable: false,
		enumerable: false,
		writable: false,
		value: function (...args: any[]) {
			const [a, b = [], ...c] = args.length === 0 ? this : args;
			const cartFn = (a: any[], b: any[]) => (<any[]>[]).concat(...a.map(d => b.map(e => (<any[]>[]).concat(d, e))));

			return b.length
				? this.cartesian(cartFn(a, b), ...c)
				: asArray(a || [])
		}
	})
}
