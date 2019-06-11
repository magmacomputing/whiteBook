import { asString } from '@lib/string.library';
import { toHex } from '@lib/number.library';

export const decodeBase64 = <T>(str: string): T =>
	JSON.parse(window.atob(str.replace('-', '+').replace('_', '/')));

export const encodeBase64 = (buf: ArrayBuffer) =>
	window.btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));

export const cryptoHash = async (source: string | Object, len: number = 64) => {
	const buffer = encodeBuffer(asString(source));
	const hash = await crypto.subtle.digest('SHA-256', buffer);

	return toHex([...Array.from(new Uint8Array(hash))], len);
}

const encodeBuffer = (str: string) => new TextEncoder().encode(str);
const decodeBuffer = (buf: Uint16Array) => new TextDecoder('utf-8').decode(buf);

const cryptoKey = crypto.subtle.generateKey({ name: 'AES-CBC', length: 128 }, false, ['encrypt', 'decrypt']);
const vector = crypto.getRandomValues(new Uint8Array(16));
const asymmetricKey = crypto.subtle.generateKey({
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: { name: 'SHA-256' }
}, false, ['sign', 'verify']);

export const cryptoEncrypt = async (data: any) =>
	crypto.subtle.encrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, encodeBuffer(data))
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoDecrypt = async (secret: Promise<ArrayBuffer>) =>
	crypto.subtle.decrypt({ name: 'AES-CBC', iv: vector }, await cryptoKey, await secret)
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoSign = async (doc: any) =>
	crypto.subtle.sign('RSASSA-PKCS1-v1_5', (await asymmetricKey).privateKey, encodeBuffer(doc))
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoVerify = async (signature: Promise<ArrayBuffer>, doc: any) =>
	crypto.subtle.verify('RSASSA-PKCS1-v1_5', (await asymmetricKey).publicKey, await signature, encodeBuffer(doc));
