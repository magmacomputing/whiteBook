import { getType, isArray, isObject, isString, isUndefined } from '@library/type.library';

export class Storage {
	#storage: globalThis.Storage;

	constructor(storage: 'local' | 'session') {
		this.#storage = (storage ?? 'local') === 'local'			// default to localStorage
			? globalThis.localStorage
			: globalThis.sessionStorage
	}

	public get<T>(key: string): T | null;
	public get<T>(key: string, dflt: T): T;
	public get<T>(key: string, dflt?: T) {
		return isUndefined(dflt)
			? this.ifObject<T>(this.#storage.getItem(key))
			: this.ifObject<T>(this.#storage.getItem(key)) ?? dflt;
	}

	public set(key: string, obj: unknown, opt = { merge: true }) {
		const prev = this.get<string | any[] | {}>(key);			// needed if merge is true

		switch (getType(obj)) {
			case 'Undefined':
				return this.del(key);															// synonym for 'removeItem'

			case 'Object':
				return this.upd(key, opt.merge
					? Object.assign(prev ?? {}, obj)								// assume prev is Object
					: obj)

			case 'Array':
				return this.upd(key, opt.merge
					? (prev as unknown[] ?? [])											// assume prev is Array
						.concat(obj)
						.distinct()																		// remove duplicates
					: obj)

			default:
				return this.upd(key, obj);
		}
	}

	public del(key: string) {
		return this.#storage.removeItem(key);
	}

	public clear() {
		return this.#storage.clear();
	}

	public keys() {
		return Object.keys(this.#storage);
	}

	public values() {
		return Object.values(this.#storage)
			.map(this.ifObject)
	}

	public entries() {
		return Object.entries(this.#storage)
			.map(([key, val]) => [key, this.ifObject(val)])
	}

	private upd(key: string, obj: unknown) {
		return this.#storage.setItem(key, (isObject(obj) || isArray(obj)
			? JSON.stringify(obj)
			: obj))
	}

	private ifObject = <T>(str: string | null) => {
		const isObj = isString(str) && str.startsWith('{') && str.endsWith('}');
		const isArr = isString(str) && str.startsWith('[') && str.endsWith(']');

		return isObj || isArr
			? JSON.parse(str as string) as T
			: str
	}
}

export const alert = (msg: any) =>
	window.alert(msg);

export const prompt = (msg: any, dflt?: any) =>
	window.prompt(msg, dflt);
