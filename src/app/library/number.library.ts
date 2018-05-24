import { isArray } from "@lib/object.library";

export const toHex = (num: number | number[] = []) => {
	return (isArray(num) ? num : [num])
		.map(val => (val + 0x100).toString(16).slice(-2))
		.join('')
		.toLowerCase();
}