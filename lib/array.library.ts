import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for de-duping an array of values
export const distinct = <T>(...value: T[]) => [... new Set(value)];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);

declare global {
	// 	interface Array<T> {												// change the global interface for Array
	// 		/** reduce an Array to remove duplicate values */
	// 		distinct<U>(callbackfn?: (value: T) => U): T extends U ? Array<T> : Array<U>;

	// 		cartesian: () => T[][];										// TODO
	// 	}

	interface ArrayExt<T> {
		filter(callbackfn: (value: T, index: number, array: T[]) => any, thisArg?: any): ArrayExt<T>;
		map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): ArrayExt<U>;
		distinct<U>(callbackfn?: <T>(value: T) => U): T extends U ? ArrayExt<T> : ArrayExt<U>;
		// cartesian<T>(a: T, b?: T, ...c: ArrayExt<T>) => ArrayExt<ArrayExt<T>>;		// TODO
	}
}

export class ArrayExt<T> extends Array<T> {
	private _map = Array.prototype.map;
	private _filter = Array.prototype.filter;

	constructor(...args: any[]) {
		super(...args);
		Object.setPrototypeOf(this, ArrayExt.prototype);
	}

	// 		filter(callback: (value: T, index: number, arr: T[]) => T[]) :T[]{
	// 			return this._filter(callback);
	// return new ArrayExt<T>(...this._filter<T>(callback))
	// }

	// map<S extends T>(callbackfn: (value: T, index: number, arr: T[]) => any): T extends S ? ArrayExt<T> : ArrayExt<S> {
	// 	return new ArrayExt(...this._map(callbackfn));
	// }

	// 	distinct<S extends T>(callbackfn?: (value: T, index: number, array: T[]) => S[]) {
	// 		return callbackfn
	// 			? this._map<T>(callbackfn).distinct()
	// 			: [...new Set<T>(this)]
	// 	}

	// 	// 	// cartesian = <T>(a: ArrayExt<T>, b?: ArrayExt<T>, ...c: ArrayExt<T>) =>
	// 	// 	// 	(b ? this.cartesian(cartFn(a, b), ...c) : a);
}