import { STORE, FIELD } from '@dbase/data/data.define';
import { FILTER, SLICES, SORTBY } from '@dbase/library/config.define';
import { ISchema, IConfig } from '@dbase/data/data.schema';

import { makeTemplate } from '@lib/string.library';
import { IObject } from '@lib/object.library';
import { isString } from '@lib/type.library';

/** rebuild values for STORES, SORTBY, FILTER variables */
export const setSchema = async (schemas: ISchema[]) => {
  const acc = schemas.reduce((acc, schema) => {
    const { [FIELD.key]: key, [FIELD.type]: type, [FIELD.hidden]: hidden } = schema;

    if (!hidden) {
      acc.slices[type] = acc.slices[type] || [];
      acc.slices[type].push(schema[FIELD.key] as STORE);
    }

    if (schema.sort)
      acc.sortby[key] = schema.sort;

    if (schema.filter)
      acc.filter[key] = schema.filter;

    return acc;													// return accumulator
  }, {                                  // init accumulator
      slices: {} as typeof SLICES,
      sortby: {} as typeof SORTBY,
      filter: {} as typeof FILTER,
    }
  );

  Object.keys(acc.slices).forEach(type => SLICES[type] = acc.slices[type].sort());
  Object.keys(acc.sortby).forEach(type => SORTBY[type] = acc.sortby[type]);
  Object.keys(acc.filter).forEach(type => FILTER[type] = acc.filter[type]);
}

// This is called so infrequently, its not worth making it reactive
/** resolve some placeholder variables in IConfig[] */
export const getConfig = (config: IConfig[], key: string) => {
  const placeholder: IObject<string> = {};

  config
    .filter(row => !row[FIELD.expire])
    .filter(row => row[FIELD.type] === 'default')		// get the placeholder values on first pass
    .filter(row => isString(row.value))
    .forEach(row => placeholder[row[FIELD.key]] = row.value);

  return config
    .filter(row => row[FIELD.type] !== 'default')		// skip Config 'defaults'
    .map(row => {
      const subst: typeof placeholder = {}
      Object.entries(row.value).forEach(item => {		// for each item in the 'value' field
        const tpl = makeTemplate(item[1]);					// turn it into a template literal
        subst[item[0]] = tpl(placeholder);					// evaluate the template literal against the placeholders
      })
      return { ...row, value: subst }               // override with substitute value
    })
    .find(row => row[FIELD.key] === key) || {} as IConfig
}