import { isArray } from '@lib/type.library';
import { cloneObj } from '@lib/object.library';

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? cloneObj(arr) : [arr];

// useful for de-duping
export const asSet = <T>(...value: T[]) => [... new Set(value)];