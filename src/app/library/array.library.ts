import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? arr : [arr];

export const arrayUnique = (value: any[]) => [... new Set(value)];