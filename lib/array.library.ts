import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for de-duping an array of values
export const deDup = <T>(...value: T[]) => [... new Set(value)];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);


declare global {
	interface Array<T> {
		deDup<U>(callbackfn?: (value: T) => U): T extends U ? T[] : U[];
	}
}
if (!Array.prototype.hasOwnProperty('deDup'))
	Array.prototype.deDup = function <U>(selector?: <T>(value: T) => U) {
		return selector
			? this.map(selector).deDup()
			: [...new Set(this)]
	}
