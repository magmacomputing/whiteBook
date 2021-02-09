import { asString, objectify, stringify } from '@library/string.library';
import { toHex } from '@library/number.library';

enum CRYPTO {
	Algorithm = 'SHA-256',
	Encoding = 'utf-8',
	SignKey = 'RSASSA-PKCS1-v1_5',
	TypeKey = 'AES-GCM',
}

export class Cipher {
	private static cryptoKey = crypto.subtle.generateKey({ name: CRYPTO.TypeKey, length: 128 }, false, ['encrypt', 'decrypt']);
	private static vector = crypto.getRandomValues(new Uint8Array(16));
	private static asymmetricKey = crypto.subtle.generateKey({
		name: CRYPTO.SignKey,
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: { name: CRYPTO.Algorithm },
	}, false, ['sign', 'verify']);

	#keys: typeof CRYPTO;

	constructor(params = {} as typeof CRYPTO) {
		this.#keys = Object.assign({ Algorithm: 'SHA-256', Encoding: 'utf-8', Sign: 'RSASSA-PKCS1-v1_5', Type: 'AES-GCM' }, params);
	}

	static decodeBase64 = <T>(str: string): T => {
		const obj = window.atob(str.replace('-', '+').replace('_', '/'));
		return objectify(obj) as T;
	}

	static encodeBase64 = (buf: any) =>
		window.btoa(stringify(buf));
	// window.btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));

	static hash = async (source: string | Object, len: number = 64, alg: AlgorithmIdentifier = 'SHA-256') => {
		const buffer = Cipher.encodeBuffer(asString(source));
		const hash = await crypto.subtle.digest(alg, buffer);

		return toHex(Array.from(new Uint8Array(hash)), len);
	}

	static encodeBuffer = (str: string) => new Uint16Array(new TextEncoder().encode(str));
	static decodeBuffer = (buf: Uint16Array) => new TextDecoder(CRYPTO.Encoding).decode(buf);

	static encrypt = async (data: any) =>
		crypto.subtle.encrypt({ name: CRYPTO.TypeKey, iv: Cipher.vector }, await Cipher.cryptoKey, Cipher.encodeBuffer(data))
			.then(result => new Uint16Array(result))
			.then(Cipher.decodeBuffer);

	static decrypt = async (secret: Promise<ArrayBuffer>) =>
		crypto.subtle.decrypt({ name: CRYPTO.TypeKey, iv: Cipher.vector }, await Cipher.cryptoKey, await secret)
			.then(result => new Uint16Array(result))
			.then(Cipher.decodeBuffer);

	static sign = async (doc: any) =>
		crypto.subtle.sign(CRYPTO.SignKey, (await Cipher.asymmetricKey).privateKey, Cipher.encodeBuffer(doc))
			.then(result => new Uint16Array(result))
			.then(Cipher.decodeBuffer);

	static verify = async (signature: Promise<ArrayBuffer>, doc: any) =>
		crypto.subtle.verify(CRYPTO.SignKey, (await Cipher.asymmetricKey).publicKey, await signature, Cipher.encodeBuffer(doc));
}
