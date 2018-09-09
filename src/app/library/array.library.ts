import { isArray } from '@lib/type.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? arr : [arr];

// useful for de-duping
export const asSet = <T>(...value: T[]) => [... new Set(value)];