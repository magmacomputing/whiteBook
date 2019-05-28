import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);


declare global {
	interface Array<T> {												// change the global interface for Array
		/** reduce an Array to remove duplicate values */
		distinct<U>(callbackfn?: (value: T) => U): T extends U ? Array<T> : Array<U>;

		cartesian: () => T[][];										// TODO
	}

	interface ArrayExt<T> {
		/** reduce an Array to remove duplicate values */
		distinct<U>(callbackfn?: (value: T) => U): T extends U ? ArrayExt<T> : ArrayExt<U>;

		// cartesian<T>(a: T, b?: T, ...c: ArrayExt<T>) => ArrayExt<ArrayExt<T>>;		// TODO
	}
}

if (!Array.prototype.hasOwnProperty('distinct'))
	Array.prototype.distinct = function <U>(selector?: <T>(value: T) => U) {
		return selector
			? this.map(selector).distinct()
			: [...new Set(this)]
	}

// if (!Array.prototype.hasOwnProperty('cartesian'))
// 	Array.prototype.cartesian = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);

export class ArrayExt<T> extends Array {
	constructor(...args: any[]) { super(...args) }

	distinct = function <U>(selector?: <T>(value: T) => U) {
		return selector
			? this.map(selector).distinct()
			: new ArrayExt(...new Set(this))
	}

	// cartesian = <T>(a: ArrayExt<T>, b?: ArrayExt<T>, ...c: ArrayExt<T>) =>
	// 	(b ? this.cartesian(cartFn(a, b), ...c) : a);
}
