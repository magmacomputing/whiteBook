import { isArray, isObject, isString, isUndefined } from '@library/type.library';

export class Storage {
	#storage: globalThis.Storage;

	constructor(storage: 'local' | 'session') {
		this.#storage = (storage ?? 'local') === 'local'
			? globalThis.localStorage
			: globalThis.sessionStorage
	}

	public get<T>(key: string): T | undefined;
	public get<T>(key: string, dflt: T): T;

	public get<T>(key: string, dflt?: T) {
		return isUndefined(dflt)
			? this.ifObject<T>(this.#storage.getItem(key))
			: this.ifObject<T>(this.#storage.getItem(key)) ?? dflt;
	}

	public set(key: string, obj: unknown) {
		return this.#storage.setItem(key, (isObject(obj) || isArray(obj)
			? JSON.stringify(obj)
			: obj))
	}

	public del(key: string) {
		return this.#storage.removeItem(key);
	}

	private ifObject = <T>(str: string | null) =>
		(isString(str) && ((str.startsWith('{') && str.endsWith('}')) || str.startsWith('[') && str.endsWith(']')))
			? JSON.parse(str) as T
			: str
}

export const alert = (msg: any) =>
	window.alert(msg);

export const prompt = (msg: any, dflt?: any) =>
	window.prompt(msg, dflt);
