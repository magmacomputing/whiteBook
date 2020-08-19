import { asString, isNumeric } from '@library/string.library';
import { asArray } from '@library/array.library';
import { TNumber, isUndefined } from '@library/type.library';

export const toHex = (num: TNumber = [], len: number = 64) => {
	return asArray(num)
		.map(val => (val + 0x100).toString(16).slice(-2))
		.join('')
		.toLowerCase()
		.substring(0, len)
}

export const suffix = (idx: number) => {
	const str = asString(idx + 1);
	let sfx = 'th';

	switch (true) {
		case str.slice(-1) === '1' && str.slice(-2) !== '11':
			sfx = 'st';
			break;
		case str.slice(-1) === '2' && str.slice(-2) !== '12':
			sfx = 'nd';
			break;
		case str.slice(-1) === '3' && str.slice(-2) !== '13':
			sfx = 'rd';
			break;
	}
	return str + sfx;
}

export const fix = (nbr: string | number, max = 2, fill?: number) =>
	nbr.toString().padStart(max, isUndefined(fill) && isNumeric(nbr) ? '0' : ' ');

export const asCurrency = (str: string | number, nbr = 2) => Number(str).toFixed(nbr);

export const asTime = (hhmi: string | number) => Number(String(hhmi).replace(':', ''));
