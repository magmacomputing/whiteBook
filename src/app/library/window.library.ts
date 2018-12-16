import { parseObj } from '@lib/object.library';
import { isObject } from '@lib/type.library';

export const setLocalStore = (key: string, obj: any) =>
	setStore(key, obj, window.localStorage);

export const getLocalStore = <T>(key: string) =>
	getStore<T>(key, window.localStorage);

export const delLocalStore = (key: string) =>
	window.localStorage.removeItem(key);

export const setSessionStore = (key: string, obj: any) =>
	setStore(key, obj, window.sessionStorage);

export const getSessionStore = <T>(key: string) =>
	getStore<T>(key, window.sessionStorage);

export const delSessionStore = (key: string) =>
	delStore(key, window.sessionStorage);

export const alert = (msg: any) =>
	window.alert(msg);

export const prompt = (msg: any, dflt?: any) =>
	window.prompt(msg, dflt);

/** Private routines to perform actions on window storage */
const setStore = (key: string, obj: any, target: Storage) => {
	target.setItem(key, (isObject(obj)
		? JSON.stringify(obj)
		: obj))
}

const getStore = <T>(key: string, target: Storage) =>
	parseObj<T>(target.getItem(key));

const delStore = (key: string, target: Storage) =>
	target.removeItem(key);