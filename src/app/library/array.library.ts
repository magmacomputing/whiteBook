import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? [...arr] : [arr];

// useful for de-duping an array of values
export const deDup = <T>(...value: T[]) => [... new Set(value)];