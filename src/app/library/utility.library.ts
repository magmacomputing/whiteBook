import { SHA256 } from 'crypto-js';
import { isString } from '@lib/object.library';

export const getHash = (source: string | Object, len: number = 40): string => {
	const str = isString(source) ? source : JSON.stringify(source);

	return SHA256(str).toString().substring(0, len);
}