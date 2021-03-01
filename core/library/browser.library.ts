import { Migration } from '@route/migrate/migrate.define';

import { getType, isUndefined } from '@library/type.library';
import { stringify, objectify } from '@library/string.library';

/**
 * Wrapper around local / session  Web Storage
 */
export class WebStore {
	#storage: globalThis.Storage;

	constructor(storage: 'local' | 'session' = 'local') {
		this.#storage = storage === 'local'										// default to localStorage
			? globalThis.localStorage
			: globalThis.sessionStorage
	}

	public get<T>(key: string): T | null;
	public get<T>(key: string, dflt: T): T;
	public get<T>(key: string, dflt?: T) {
		const obj = objectify(this.#storage.getItem(key));
		return obj ?? (isUndefined(dflt) ? obj : dflt)
	}

	public set(key?: string, obj?: unknown, opt = { merge: true }) {
		if (isUndefined(key))																	// synonym for 'clear'
			return this.clear();

		let prev = this.get<string | any[] | {}>(key);				// needed if merge is true
		const type = getType(obj);

		switch (type) {
			case 'Undefined':
				return this.del(key);															// synonym for 'removeItem'

			case 'Object':
				prev = prev ?? {};
				return this.upd(key, opt.merge
					? Object.assign(prev, obj)											// assume prev is Object
					: obj)

			case 'Array':
				prev = prev ?? [];
				return this.upd(key, opt.merge
					? (prev as unknown[])														// assume prev is Array
						.concat(obj)
						.distinct()																		// remove duplicates
					: obj)

			case 'Map':
				prev = prev ?? new Map();
				if (opt.merge) {
					(obj as Map<any, any>)													// merge into prev Map
						.forEach((val, key) => (prev as Map<any, any>).set(key, val));
					return this.upd(key, prev);
				}
				return this.upd(key, obj);												// else overwrite new Map

			case 'Set':
				prev = prev ?? new Set();
				if (opt.merge) {
					(obj as Set<any>).
						forEach(itm => (prev as Set<any>).add(itm));	// merge into prev Set
					return this.upd(key, prev);
				}
				return this.upd(key, obj);												// else overwrite new Set

			default:
				return this.upd(key, obj);
		}
	}

	public del(key: string) {
		this.#storage.removeItem(key);
		return this;
	}

	public clear() {
		this.#storage.clear();
		return this;
	}

	public keys() {
		return Object.keys(this.#storage);
	}

	public values<T>() {
		return Object.values<T>(this.#storage)
			.map(objectify)
	}

	public entries<T>() {
		return Object.entries<T>(this.#storage)
			.map(([key, val]) => [key, objectify(val)])
	}

	private upd(key: string, obj: unknown) {
		this.#storage.setItem(key, stringify(obj));
		return this;
	}
}

export const alert = (msg: any) => window.alert(msg);
export const prompt = (msg: any, dflt?: any) => window.prompt(msg, dflt);

export namespace WebStore {
	export const State = '@@STATE';								// NGXS Store in localStorage
	export const Admin = '@@ADMIN';								// administrator settings

	export const local = new WebStore('local');		// global reference to localStorage
	export const session = new WebStore('session');

	export interface AdminStore {
		migrate: {
			hidden: boolean;
			credit: Migration.CREDIT;
		}
	}
}