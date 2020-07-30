// Typescript Decorators

export function Sealed(constructor: Function) {
	Object.seal(constructor);
	Object.seal(constructor.prototype);
}

export function Debug<T extends { new(...args: any[]): {} }>(constructor: T) {
	return class extends constructor {
		constructor(...args: any[]) {
			super(...args);
		}
	}
}