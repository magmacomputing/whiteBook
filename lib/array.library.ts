import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for de-duping an array of values
export const mapUnique = <T>(...value: T[]) => [... new Set(value)];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);


declare global {
	interface Array<T> {
		mapUnique<U>(callbackfn?: (value: T) => U): T extends U ? T[] : U[];

		cartesian: () => T[][];
	}
}
if (!Array.prototype.hasOwnProperty('mapUnique'))
	Array.prototype.mapUnique = function <U>(selector?: <T>(value: T) => U) {
		return selector
			? this.map(selector).mapUnique()
			: [...new Set(this)]
	}

// if (!Array.prototype.hasOwnProperty('cartesian'))
// 	Array.prototype.cartesian = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);
