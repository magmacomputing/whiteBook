import { isString, isArray, isNumber, isFunction } from '@lib/object.library';
import { toHex } from '@lib/number.library';

export const getHash = async (source: string | Object, len: number = 40) => {
	const str = isString(source) ? source : JSON.stringify(source);
	const buffer = toArrayBuffer(str);
	const hash = await crypto.subtle.digest('SHA-256', buffer);

	return toHex([...(new Uint8Array(hash))]);
}

export const getSign = async (source: any) => {
	const str = isString(source) ? source : JSON.stringify(source);
	const buffer = toArrayBuffer(str);
	const key = new CryptoKey();

	const sign = await crypto.subtle.sign('sha-256', key, buffer);
}

const toArrayBuffer = (str: string) => {
	const buf = new ArrayBuffer(str.length * 2);		// 2 bytes for each char
	const bufView = new Uint16Array(buf);

	[...str]																				// convert string to char[]
		.forEach((chr, idx) => bufView[idx] = chr.charCodeAt(0))
	return buf;
}
