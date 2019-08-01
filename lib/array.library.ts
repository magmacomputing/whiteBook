import { cloneObj } from '@lib/object.library';

export const asArray = <T>(arr: T | T[] = []) => Array.isArray(arr) ? [...arr] : [arr];

declare global {
	interface Array<T> {
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

if (!Array.prototype.hasOwnProperty('truncate')) {
	Array.prototype.truncate = function (base = 0) {
		this.length === base;
		return this;
	}
}

if (!Array.prototype.hasOwnProperty('distinct')) {
	Array.prototype.distinct = function (selector?: (value: any, index: number, array: any[]) => {}) {
		return selector
			? this.map(selector).distinct()
			: Array.from(new Set(this))
	}
}

if (!Array.prototype.hasOwnProperty('cartesian')) {
	Array.prototype.cartesian = function (...args: any[]) {
		const [a, b = [], ...c] = args.length === 0 ? this : args;

		return b.length
			? this.cartesian(cartFn(a, b), ...c)
			: [...a || []]
	}
}

const cartFn = (a: any[], b: any[]) => (<any[]>[]).concat(...a.map(d => b.map(e => (<any[]>[]).concat(d, e))));

// insert a value into an array by its sorted position
export const sortInsert = <T>(arr: T[], val: T) => {
	let low = 0, high = arr.length;
	let clone = cloneObj(arr);

	while (low < high) {
		const mid = (low + high) >>> 1;				// divide by 2
		if (clone[mid] < val)
			low = mid + 1
		else high = mid
	}

	clone.splice(low, 0, val);
	return clone;
}