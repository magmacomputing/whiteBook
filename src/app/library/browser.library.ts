import { ɵBrowserPlatformLocation } from '@angular/common';
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

	public set(key?: string, obj?: unknown, opt = { merge: true }) {
		if (isUndefined(key))
			return this.clear();																// synonym for 'clear'

		const prev = this.get<string | any[] | {}>(key);			// needed if merge is true
		const type = getType(obj);

		switch (type) {
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

			case 'Map':
				const map = Object.fromEntries((obj as Map<any, any>).entries());
				return this.upd(key, opt.merge
					? Object.assign(prev ?? {}, map)
					: map, type)

			case 'Set':
				const set = Array.from((obj as Set<any>).values());
				return this.upd(key, opt.merge
					? (prev as unknown[] ?? [])
						.concat(set)
						.distinct()
					: set, type)

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

	private upd(key: string, obj: unknown, type?: 'Map' | 'Set') {
		let val: string;

		switch (true) {
			case type === 'Map':
			case type === 'Set':
			case isObject(obj):
			case isArray(obj):
				val = JSON.stringify(obj);
				if (type)
					val = `${type}:${val}`
				break;

			default:
				val = obj as string;
				break;
		}

		return this.#storage.setItem(key, val);
	}

	private ifObject = <T>(str: string | null) => {
		const isObj = isString(str) && str.startsWith('{') && str.endsWith('}');
		const isArr = isString(str) && str.startsWith('[') && str.endsWith(']');
		const isMap = isString(str) && str.startsWith('map:{') && str.endsWith('}');
		const isSet = isString(str) && str.startsWith('set:[') && str.endsWith(']');

		switch (true) {
			case isObj:
			case isArr:
				return JSON.parse(str as string) as T;

			case isMap:
				return new Map(Object.entries(JSON.parse((str as string)?.substring(4))));

			case isSet:
				return new Set(JSON.parse((str as string).substring(4)));

			default:
				return str;
		}
	}
}

export const alert = (msg: any) =>
	window.alert(msg);

export const prompt = (msg: any, dflt?: any) =>
	window.prompt(msg, dflt);
