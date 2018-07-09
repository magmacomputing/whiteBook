import { asArray } from "@lib/object.library";

export const toHex = (num: number | number[] = [], len: number = 40) => {
	return asArray(num)
		.map(val => (val + 0x100).toString(16).slice(-2))
		.join('')
		.toLowerCase()
		.substring(0, len)
}