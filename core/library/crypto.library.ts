import { asString } from '@library/string.library';
import { toHex } from '@library/number.library';

enum CRYPTO {
	algorithm = 'SHA-256',
	encoding = 'utf-8',
	signKey = 'RSASSA-PKCS1-v1_5',
	typeKey = 'AES-GCM',
}

export const decodeBase64 = <T>(str: string): T =>
	JSON.parse(window.atob(str.replace('-', '+').replace('_', '/')));

export const encodeBase64 = (buf: ArrayBuffer) =>
	window.btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));

export const cryptoHash = async (source: string | Object, len: number = 64) => {
	const buffer = encodeBuffer(asString(source));
	const hash = await crypto.subtle.digest(CRYPTO.algorithm, buffer);

	return toHex(Array.from(new Uint8Array(hash)), len);
}

const encodeBuffer = (str: string) => new TextEncoder().encode(str);
const decodeBuffer = (buf: Uint16Array) => new TextDecoder(CRYPTO.encoding).decode(buf);

const cryptoKey = crypto.subtle.generateKey({ name: CRYPTO.typeKey, length: 128 }, false, ['encrypt', 'decrypt']);
const vector = crypto.getRandomValues(new Uint8Array(16));
const asymmetricKey = crypto.subtle.generateKey({
	name: CRYPTO.signKey,
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: { name: CRYPTO.algorithm }
}, false, ['sign', 'verify']);

export const cryptoEncrypt = async (data: any) =>
	crypto.subtle.encrypt({ name: CRYPTO.typeKey, iv: vector }, await cryptoKey, encodeBuffer(data))
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoDecrypt = async (secret: Promise<ArrayBuffer>) =>
	crypto.subtle.decrypt({ name: CRYPTO.typeKey, iv: vector }, await cryptoKey, await secret)
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoSign = async (doc: any) =>
	crypto.subtle.sign(CRYPTO.signKey, (await asymmetricKey).privateKey, encodeBuffer(doc))
		.then(result => new Uint16Array(result))
		.then(decodeBuffer);

export const cryptoVerify = async (signature: Promise<ArrayBuffer>, doc: any) =>
	crypto.subtle.verify(CRYPTO.signKey, (await asymmetricKey).publicKey, await signature, encodeBuffer(doc));
