import { isString } from '@lib/object.library';

export const getHash = async (source: string | Object, len: number = 40): Promise<string> => {
	const str = isString(source) ? source : JSON.stringify(source);

	const buffer = stringToBuffer(str);
	const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))

	return Array.from(new Uint8Array(hash))
		.map(b => ('00' + b.toString(16)).slice(-2))
		.join('')
}

const stringToBuffer = (str: string) => {
	var buf = new ArrayBuffer(str.length * 2);		// 2 bytes for each char
	var bufView = new Uint8Array(buf);

	const msgBuffer = new TextEncoder().encode(str);

	[...str]
		.forEach((chr, idx) => bufView[idx] = chr.charCodeAt(0))
	return buf;
}