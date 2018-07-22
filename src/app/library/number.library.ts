import { asArray, asString } from '@lib/object.library';

export const toHex = (num: number | number[] = [], len: number = 40) => {
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