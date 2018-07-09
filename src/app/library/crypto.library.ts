import { asString } from '@lib/object.library';
import { toHex } from '@lib/number.library';

export const decodeBase64 = <T>(str: string): T => {
  const base64Url = str.replace('-', '+').replace('_', '/');
  return JSON.parse(window.atob(base64Url));
}

export const encodeBase64 = (buf: ArrayBuffer) => {
	return window.btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));
}

export const cryptoHash = async (source: string | Object, len: number = 64) => {
	const buffer = asBuffer(asString(source));
	const hash = await crypto.subtle.digest('SHA-256', buffer);

	return toHex([...(new Uint8Array(hash))], len);
}

// TODO: new TextEncoder() when Typescript 2.8 supported in Webpack
const asBuffer = (str: string) => {
		// return new TextEncoder('utf-8').encode(str);
	const buf = new ArrayBuffer(str.length * 2);		// 2 bytes for each char
	const bufView = new Uint16Array(buf);

	[...str]																				// convert string to char[]
		.forEach((chr, idx) => bufView[idx] = chr.charCodeAt(0))
	return buf;
}

// TODO: new TextDecoder() when Typescript 2.8 supported in Webpack
const fromBuffer = (buf: Uint16Array) => {
	// return new TextDecoder('utf-8').decode(buf);
	return [...buf]
		.map(chr => String.fromCharCode(chr))
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
	return crypto.subtle.encrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, asBuffer(data))
		.then(result => new Uint16Array(result))
		.then(fromBuffer);
}

export const cryptoDecrypt = async (secret: Promise<ArrayBuffer>) => {
	return crypto.subtle.decrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, await secret)
		.then(result => new Uint16Array(result))
		.then(fromBuffer);
}

export const cryptoSign = async (doc: any) => {
	return crypto.subtle.sign('RSASSA-PKCS1-v1_5', (await asymetricKey).privateKey, asBuffer(doc))
		.then(result => new Uint16Array(result))
		.then(fromBuffer);
}

export const cryptoVerify = async (signature: Promise<ArrayBuffer>, doc: any) => {
	return crypto.subtle.verify('RSASSA-PKCS1-v1_5', (await asymetricKey).publicKey, await signature, asBuffer(doc));
}
