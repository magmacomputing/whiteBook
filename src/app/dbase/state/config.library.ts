import { STORE, FIELD } from '@dbase/data.define';
import type { Schema, Config } from '@dbase/data.schema';
import { outline } from '@dbase/state/config.define';

import { getEnumKeys, isString } from '@library/type.library';
import { sortInsert, asArray } from '@library/array.library';
import { makeTemplate } from '@library/string.library';

/** rebuild values for SLICES / SORTBY / FILTER objects */
export const setSchema = (schemas: Schema[] = []) => {
	getEnumKeys(outline.FILTER)
		.forEach(key => delete outline.FILTER[key])
	getEnumKeys(outline.SLICES)
		.forEach(key => delete outline.SLICES[key])
	getEnumKeys(outline.SORTBY)
		.forEach(key => delete outline.SORTBY[key])

	schemas.forEach(schema => {
		const { [FIELD.Key]: key, [FIELD.Type]: type, [FIELD.Hidden]: hidden } = schema;

		if (!hidden)
			outline.SLICES[type] = sortInsert(outline.SLICES[type] || [], schema[FIELD.Key]);

		outline.SORTBY[key] = schema[FIELD.Sort]									// always use Effective Date as final sort-field
			? asArray<FIELD>(schema[FIELD.Sort]).concat(FIELD.Effect)
			: [FIELD.Sort, FIELD.Key, FIELD.Effect];							// special: assume sort order

		if (schema.filter && schema[FIELD.Type].toString() === schema[FIELD.Key].toString())
			outline.FILTER[type] = asArray<FIELD>(schema.filter);	// Collection filter
	})
}

// This is called so infrequently, its not worth making it reactive
/** Resolve some placeholder variables in IConfig[] */
export const getConfig = (config: Config[], type: string, key: string) => {
	const placeholder: Record<string, string> = {};

	config
		.filter(row => row[FIELD.Type] === 'default')		// get the placeholder values on first pass
		.filter(row => !row[FIELD.Expire])
		.filter(row => isString(row.value))							// restrict string-only template placeholders
		.forEach(row => placeholder[row[FIELD.Key]] = row.value);

	const clone = config
		.filter(row => row[FIELD.Key] === key)					// requested Key
		.filter(row => row[FIELD.Type] === type)				// requested Type
		.map(row => {
			const subst: typeof placeholder = {}
			Object.entries<string>(row.value)
				.forEach(([key, val]) => {									// for each item in the 'value' field
					const tpl = makeTemplate(val);						// turn it into a template literal
					subst[key] = tpl(placeholder);						// evaluate the template literal against the placeholders
				})
			return { ...row, value: subst }               // override with substitute value
		})

	return clone[0] || { value: {} } as Config;				// first element, else empty value
}

/** Rebuild global COMMENTS variable */
export const setConfig = (config: Config[] = []) => {
	getEnumKeys(outline.COMMENTS)
		.forEach(key => delete outline.COMMENTS[key]);

	config
		.filter(row => row[FIELD.Type] === STORE.Comment)
		.forEach(row => {
			switch (row[FIELD.Key]) {
				case 'words':
					outline.COMMENTS.words = row.value;
					break;
				case 'patterns':
					outline.COMMENTS.patterns = row.value;
					break;
			}
		})
}