import { isNumeric } from '@lib/string.library';
import { isObject, getType, isArray, isString } from '@lib/type.library';

export interface IObject<T> { [key: string]: T; }

/** Get nested value */
export const getPath = <T>(obj: object | null | undefined, path: string): T =>
  path.split('.')
    .reduce((xs: any, x) => (xs && xs[x]) ? xs[x] : null, obj);

/** Sort Object by its keys */
export const sortObj = (obj: any, deep: boolean = true): any => {
  const col: IObject<any> = {};

  if (!isObject(obj))
    return obj;

  return Object.keys(obj)
    .sort()
    .reduce((col, key) => {
      const type = getType(obj[key]);
      if (deep && type !== 'Null' && type !== 'Undefined') {
        switch (type) {
          case 'Object':
            col[key] = sortObj(obj[key], deep);   // recurse
            break;

          case 'Array':
            col[key] = obj[key].every(isNumeric)
              ? obj[key].sort((a: number, b: number) => a - b)
              : obj[key].sort()                   // sort Array    
            break;

          case 'Date':
            col[key] = new Date();
            col[key].setTime(obj[key].getTime());
            break;

          default:
            col[key] = obj[key];
            break;
        }
      }
      else col[key] = obj[key];
      return col;
    }, col);
};

/** sort Object by multiple keys */
export const sortKeys = (...keys: any[]): any => (a: any, b: any) => {
  const key = keys[0];														// take out the first key
  switch (true) {
    case keys.length === 0:
      return 0;
    case a[key] < b[key]:
      return -1;
    case a[key] > b[key]:
      return 1;
    default:
      return sortKeys(...keys.slice(1))(a, b);
  }
}

/** lowerCase Object keys */
export const lowerObj = (obj: any) => {
  if (!isObject(obj))
    return obj;

  let newObj: IObject<any>;
  switch (getType(obj)) {
    case 'Object':
      newObj = {};
      Object.keys(obj).forEach(key => newObj[key.toLowerCase()] = lowerObj(obj[key]));
      break;

    case 'Array':
      newObj = obj.map((key: any, idx: number) => lowerObj(obj[idx]));
      break;

    default:
      newObj = obj;
      break;
  }

  return newObj;
}

/** Convert Array[{}] to Object{{}} */
export const objArray = (obj: any) => {
  if (isArray(obj) && isObject(obj[0])) {
    const newObj: IObject<any> = {};

    obj.forEach(itm =>
      Object.keys(itm)
        .forEach(key => newObj[key] = itm[key])
    )
    return newObj;
  }
  else return obj;
}

/** deep-clone Object */
export const cloneObj = <T>(obj: T): T => {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (e) {
    return obj;
  }
};

/** deep-compare Objects for equality */
export const equalObj = (obj1: any, obj2: any): boolean => {
  Object.keys(obj1).forEach(field => {
    if (!isObject(obj1[field]) && obj1[field] != obj2[field])
      console.log('change: <', field, '> ', obj2[field], ' => ', obj1[field]);
  })
  return Object.keys(obj1).every(field =>
    isObject(obj1[field])
      ? equalObj(obj1[field], obj2[field])      // recurse to compare sub-object
      : obj1[field] == obj2[field]
  );
}

export const isEmpty = (obj: object | any[]): boolean =>
  (isObject(obj) && Object.keys(obj).length === 0) ||
  (isArray(obj) && obj.length === 0)
