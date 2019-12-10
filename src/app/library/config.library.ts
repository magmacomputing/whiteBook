import { STORE, FIELD, COLLECTION } from '@dbase/data/data.define';
import { FILTER, SLICES, SORTBY, COMMENT } from '@library/config.define';
import { ISchema, IConfig } from '@dbase/data/data.schema';

import { isString } from '@lib/type.library';
import { sortInsert } from '@lib/array.library';
import { makeTemplate } from '@lib/string.library';

/** rebuild values for SLICES, SORTBY, FILTER variables */
export const setSchema = (schemas: ISchema[] = []) => {
	Object.keys(FILTER)
		.forEach(key => delete FILTER[key as COLLECTION])
	Object.keys(SLICES)
		.forEach(key => delete SLICES[key as COLLECTION])
	Object.keys(SORTBY)
		.forEach(key => delete SORTBY[key as STORE])

	schemas.forEach(schema => {
		const { [FIELD.key]: key, [FIELD.type]: type, [FIELD.hidden]: hidden } = schema;

		if (!hidden)
			SLICES[type] = sortInsert(SLICES[type] || [], schema[FIELD.key]);

		if (schema.sort)
			SORTBY[key] = schema.sort;

		if (schema.filter && schema[FIELD.type].toString() === schema[FIELD.key].toString())
			FILTER[type] = schema.filter;					// Collection filter
	})
}

// This is called so infrequently, its not worth making it reactive
/** resolve some placeholder variables in IConfig[] */
export const getConfig = (config: IConfig[], key: string) => {
	const placeholder: Record<string, string> = {};

	config
		.filter(row => !row[FIELD.expire])
		.filter(row => row[FIELD.type] === 'default')		// get the placeholder values on first pass
		.filter(row => isString(row.value))
		.forEach(row => placeholder[row[FIELD.key]] = row.value);

	return config
		.filter(row => row[FIELD.type] !== 'default')		// skip Config 'defaults'
		.map(row => {
			const subst: typeof placeholder = {}
			Object.entries<any>(row.value).forEach(item => {		// for each item in the 'value' field
				const tpl = makeTemplate(item[1]);					// turn it into a template literal
				subst[item[0]] = tpl(placeholder);					// evaluate the template literal against the placeholders
			})
			return { ...row, value: subst }               // override with substitute value
		})
		.find(row => row[FIELD.key] === key) || {} as IConfig
}

/** Rebuild global COMMENT variable */
export const setConfig = (config: IConfig[] = []) => {
	Object.keys(COMMENT)
		.forEach(key => delete COMMENT[key as keyof typeof COMMENT]);

	config.forEach(row => {
		switch (row[FIELD.type]) {
			case 'words':
				COMMENT.words = row.value;
				break;
			case 'patterns':
				COMMENT.patterns = row.value;
				break;
		}
	})
}