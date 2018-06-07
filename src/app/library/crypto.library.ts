import { isString, isArray, isNumber, isFunction } from '@lib/object.library';
import { toHex } from '@lib/number.library';

export const decodeBase64 = (str: string): any => {
  const base64Url = str.replace('-', '+').replace('_', '/');
  return JSON.parse(window.atob(base64Url));
}

export const cryptoHash = async (source: string | Object, len: number = 40) => {
	const str = isString(source) ? source : JSON.stringify(source);
	const buffer = toArrayBuffer(str);
	const hash = await crypto.subtle.digest('SHA-256', buffer);

	return toHex([...(new Uint8Array(hash))]);
}

// TODO: new TextEncoder() when Typescript 2.8 supported in Webpack
const toArrayBuffer = (str: string) => {
	const buf = new ArrayBuffer(str.length * 2);		// 2 bytes for each char
	const bufView = new Uint16Array(buf);

	[...str]																				// convert string to char[]
		.forEach((chr, idx) => bufView[idx] = chr.charCodeAt(0))
	return buf;
}

const fromArrayBuffer = (buf: Uint16Array) => {
	return [...buf]
		.map((chr, idx) => String.fromCharCode(chr))
		.join('');
}

const cryptoKey = crypto.subtle.generateKey({ name: 'AES-CBC', length: 128 }, false, ['encrypt', 'decrypt']);
const vector = crypto.getRandomValues(new Uint8Array(16));
const asymetricKey = crypto.subtle.generateKey({
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: { name: 'SHA-256' }
}, false, ['sign', 'verify']);

export const cryptoEncrypt = async (data: any) => {
	return crypto.subtle.encrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, toArrayBuffer(data))
		.then(result => new Uint16Array(result))
		.then(fromArrayBuffer);
}

export const cryptoDecrypt = async (secret: Promise<ArrayBuffer>) => {
	return crypto.subtle.decrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, await secret)
		.then(result => new Uint16Array(result))
		.then(fromArrayBuffer);
}

export const cryptoSign = async (doc: any) => {
	return crypto.subtle.sign('RSASSA-PKCS1-v1_5', (await asymetricKey).privateKey, toArrayBuffer(doc))
		.then(result => new Uint16Array(result))
		.then(fromArrayBuffer);
}

export const cryptoVerify = async (signature: Promise<ArrayBuffer>, doc: any) => {
	return crypto.subtle.verify('RSASSA-PKCS1-v1_5', (await asymetricKey).publicKey, await signature, toArrayBuffer(doc));
}
