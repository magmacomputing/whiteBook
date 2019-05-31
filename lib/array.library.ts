export const asArray = <T>(arr: T | T[] = []) => Array.isArray(arr) ? [...arr] : [arr];

// useful for cartesian product of arrays
const cartFn = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
export const cartesian: any = (a: any[], b?: any[], ...c: any[]) => (b ? cartesian(cartFn(a, b), ...c) : a);

declare global {
	interface Array<T> {
		distinct(): T[];
		distinct<S>(mapfn: (value: T, index: number, array: T[]) => S, thisArg?: any): S[];

		truncate(base?: number): T[];

		cartesian(a?: T, b?: T, ...c: T[]): T;
	}
}

if (!Array.prototype.hasOwnProperty('truncate')) {
	Array.prototype.truncate = function (nbr = 0) {
		this.length === nbr;
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

if (!Array.prototype.hasOwnProperty('cartesian')) {
	Array.prototype.cartesian = function (b?, ...c) {
		return this[1]
			? this.cartesian(
				(b: any) => [].concat(...this.map((d: any) => b.map((e: any) => [].concat(d, e)))),
				...c)
			: this
	}
}
