import { ifObject } from '@library/object.library';
import { isObject } from '@library/type.library';

export const setLocalStore = (key: string, obj: any) =>
	setStorage(key, obj, window.localStorage);

export const getLocalStore = <T>(key: string, dflt?: T) =>
	getStorage<T>(key, window.localStorage) || dflt;

export const delLocalStore = (key: string) =>
	window.localStorage.removeItem(key);

export const setSessionStore = (key: string, obj: any) =>
	setStorage(key, obj, window.sessionStorage);

export const getSessionStore = <T>(key: string, dflt?: T) =>
	getStorage<T>(key, window.sessionStorage) || dflt;

export const delSessionStore = (key: string) =>
	delStorage(key, window.sessionStorage);

export const alert = (msg: any) =>
	window.alert(msg);

export const prompt = (msg: any, dflt?: any) =>
	window.prompt(msg, dflt);

/** Private routines to perform actions on window storage */
const setStorage = (key: string, obj: any, target: Storage) => {
	target.setItem(key, (isObject(obj)
		? JSON.stringify(obj)
		: obj));
}

const getStorage = <T>(key: string, target: Storage, dflt?: T) =>
	ifObject<T>(target.getItem(key)) as T || dflt;

const delStorage = (key: string, target: Storage) =>
	target.removeItem(key);