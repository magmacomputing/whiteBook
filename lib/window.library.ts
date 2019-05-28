import { parseObj } from '@lib/object.library';
import { isObject } from '@lib/type.library';

export const setLocalStore = (key: string, obj: any) =>
	setStorage(key, obj, window.localStorage);

export const getLocalStore = <T>(key: string) =>
	getStorage<T>(key, window.localStorage);

export const delLocalStore = (key: string) =>
	window.localStorage.removeItem(key);

export const setSessionStore = (key: string, obj: any) =>
	setStorage(key, obj, window.sessionStorage);

export const getSessionStore = <T>(key: string) =>
	getStorage<T>(key, window.sessionStorage);

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
		: obj))
}

const getStorage = <T>(key: string, target: Storage) =>
	parseObj<T>(target.getItem(key));

const delStorage = (key: string, target: Storage) =>
	target.removeItem(key);

/** calculate an approximate browser fingerprint */
export const getDeviceId = () => {
	let nav = window.navigator;
	let screen = window.screen;

	return `
		${nav.mimeTypes.length}
		${nav.userAgent.replace(/\D+/g, '')}
		${nav.plugins.length}
		${screen.height || ''}
		${screen.width || ''}
		${screen.pixelDepth || ''}
		`
		.replace(/(\r\n|\n|\r|\t|\s)/gm, "")
}