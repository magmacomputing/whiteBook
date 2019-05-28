import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);


declare global {
	interface ArrayExt<T> {												// change the global interface for Array
		/** reduce an Array to remove duplicate values */
		distinct<U>(callbackfn?: (value: T) => U): T extends U ? ArrayExt<T> : ArrayExt<U>;
		
		cartesian: () => T[][];
	}
}
export class ArrayExt<T> extends Array {
	constructor(...args: any[]) {
		super(...args);
	}
	
	// useful for de-duping an array of values
	distinct = function <U>(selector?: <T>(value: T) => U) {
		return selector
			? this.map(selector).distinct()
			: [...new Set(this)]
	}

	cartesian = function () {

	}
}
// if (!Array.prototype.hasOwnProperty('distinct'))
// 	Array.prototype.distinct = function <U>(selector?: <T>(value: T) => U) {
// 		return selector
// 			? this.map(selector).distinct()
// 			: [...new Set(this)]
// 	}

// if (!Array.prototype.hasOwnProperty('cartesian'))
// 	Array.prototype.cartesian = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);
