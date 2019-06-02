import { isUndefined } from 'util';
import { getType } from './type.library';

export const asArray = <T>(arr: T | T[] = []) => Array.isArray(arr) ? [...arr] : [arr];

// useful for cartesian product of arrays
// const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
// export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);

declare global {
	interface Array<T> {
		distinct(): T[];
		distinct<S>(mapfn: (value: T, index: number, array: T[]) => S, thisArg?: any): S[];

		truncate(base?: number): T[];

		cartesian(): T[];
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
			: [...new Set(this)];
	}
}

const cartFn = (a: any[], b: any[]) => (<any[]>[]).concat(...a.map(d => b.map(e => (<any[]>[]).concat(d, e))));
if (!Array.prototype.hasOwnProperty('cartesian')) {
	Array.prototype.cartesian = function (...args: any[]) {
		const [a, b = [], ...c] = args.length === 0 ? this : args;

		return b.length
			? this.cartesian(cartFn(a, b), ...c)
			: [...a || []]
	}
}
