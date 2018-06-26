import { isNumeric } from '@lib/string.library';
export interface IObject<T> { [key: string]: T; }

/** General <object> functions */

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
export const sortKeys = (keys: any[] = []): any => (a: any, b: any) => {
  const key = keys[0];														// take out the first key
  switch (true) {
    case keys.length === 0:
      return 0;
    case a[key] < b[key]:
      return -1;
    case a[key] > b[key]:
      return 1;
    default:
      return sortKeys(keys.slice(1))(a, b);
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

    obj.forEach(itm => {
      Object.keys(itm)
        .forEach(key => newObj[key] = itm[key])
    })
    return newObj;
  }
  else return obj;
}

/** deep-clone Object */
export const cloneObj = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

/** return a ProperCase string of an object's type */
export const getType = (obj?: any): string => Object.prototype.toString.call(obj).slice(8, -1);

/** return a boolean if obj matches type */
export const isType = (obj: any, type: string = 'Object'): boolean => getType(obj).toLowerCase() === type.toLowerCase();

export const isString = (obj?: any): obj is string => isType(obj, 'String');
export const isNumber = (obj?: any): obj is number => isType(obj, 'Number');
export const isObject = <T>(obj?: T): obj is T => isType(obj, 'Object');
export const isArray = (obj?: any): obj is any[] => isType(obj, 'Array');
export const isNull = (obj?: any): obj is null => isType(obj, 'Null');
export const isFunction = (obj?: any): obj is Function => isType(obj, 'Function') || isType(obj, 'AsyncFunction');
export const isPromise = <T>(obj?: any): obj is Promise<T> => isType(obj, 'Promise');
export const isUndefined = (obj?: any): obj is undefined => isType(obj, 'Undefined');

export const isEmpty = (obj: object | any[]): boolean =>
  (isObject(obj) && Object.keys(obj).length === 0) ||
  (isArray(obj) && obj.length === 0)

export const asArray = <T>(arr: T | T[] = []) => isArray(arr) ? arr : [arr];
export const asString = (str: any = '') => isString(str) ? str : JSON.stringify(str);