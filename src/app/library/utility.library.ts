import { IPromise } from "./utility.interface";
import { isNumber, isString, isFunction } from "@lib/object.library";

/** General utility functions */

/** when we dont care about the catch() */
export const fnIgnore = (...arg: any[]) => { };

/** store a Promise and its callbacks, for later fulfilment */
export const createPromise = <T>() => {
	const obj: any = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.resolve = resolve;
		obj.reject = reject;
	});

	return obj as IPromise<T>;
}

// ~~~~~~~~~~~~~~~~~~~~~~
// declare class opt {
// 	direction?: number
// }
// interface IThenBy<T> {
// 	(v1: T, v2: T): number;
// 	thenBy(key: ((v1: T, v2?: T) => any) | keyof T, direction?: number | opt): IThenBy<T>;
// }
// declare function firstByX<T = any>(key: ((v1: T, v2?: T) => any) | keyof T, direction?: number | opt): IThenBy<T>;

// export class firstBy {

// 	private identity(v: any) { return v; }

// 	private ignoreCase(v: any) { return isString(v) ? v.toLowerCase() : v; }

// 	private makeCompareFunction(f: Function | any, opt: any) {
// 		opt = isNumber(opt) ? { direction: opt } : opt || {};
// 		let prop: any;
// 		if (!isFunction(f)) {
// 			prop = f;											// stash 'f' as property
// 			// make unary function
// 			f = (v1: any) => { !!v1[prop] ? v1[prop] : '' }
// 		}
// 		if (f.length === 1) {
// 			// f is a unary function mapping a single item to its sort score
// 			let uf = f;
// 			let preprocess = opt.ignoreCase ? this.ignoreCase : this.identity;
// 			f = (v1: any, v2: any) => { preprocess(uf(v1)) < preprocess(uf(v2)) ? -1 : preprocess(uf(v1)) > preprocess(uf(v2)) ? 1 : 0; }
// 		}
// 		if (opt.direction === -1) return (v1: any, v2: any) => { -f(v1, v2) };
// 		return f;
// 	}

// 	/* adds a secondary compare function to the target function (`this` context)
// 		 which is applied in case the first one returns 0 (equal)
// 		 returns a new compare function, which has a `thenBy` method as well */
// 	private tb(func: any, opt: any) {
// 		var x = typeof (this) === "function" ? this : false;
// 		var y = this.makeCompareFunction(func, opt);
// 		var f = x ? (a: any, b: any) => {
// 			x(a, b) || y(a, b);
// 		}
// 			: y;
// 		f.thenBy = this.tb;
// 		return f;
// 	}
// 	return tb;
// })