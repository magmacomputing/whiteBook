import { STORE, FIELD, COLLECTION } from '@dbase/data.define';
import { FILTER, SLICES, SORTBY, COMMENT } from '@dbase/state/config.define';
import { Schema, Config } from '@dbase/data.schema';

import { isString } from '@library/type.library';
import { sortInsert, asArray } from '@library/array.library';
import { makeTemplate } from '@library/string.library';

/** rebuild values for SLICES / SORTBY / FILTER objects */
export const setSchema = (schemas: Schema[] = []) => {
	Object.keys(FILTER)
		.forEach(key => delete FILTER[key as COLLECTION])
	Object.keys(SLICES)
		.forEach(key => delete SLICES[key as COLLECTION])
	Object.keys(SORTBY)
		.forEach(key => delete SORTBY[key as STORE])

	schemas.forEach(schema => {
		const { [FIELD.Key]: key, [FIELD.Type]: type, [FIELD.Hidden]: hidden } = schema;

		if (!hidden)
			SLICES[type] = sortInsert(SLICES[type] || [], schema[FIELD.Key]);

		SORTBY[key] = schema[FIELD.Sort]									// always use Effective Date as final sort-field
			? asArray(schema[FIELD.Sort]).concat(FIELD.Effect)
			: [FIELD.Sort, FIELD.Key, FIELD.Effect];				// special: assume sort order

		if (schema.filter && schema[FIELD.Type].toString() === schema[FIELD.Key].toString())
			FILTER[type] = schema.filter;									// Collection filter
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

	return clone[0] || { value: {} } as Config;			// first element, else empty value
}

/** Rebuild global COMMENT variable */
export const setConfig = (config: Config[] = []) => {
	type TComment = keyof typeof COMMENT;							// restrict to known Comment-types
	Object.keys(COMMENT)
		.forEach(key => delete COMMENT[key as TComment]);

	config
		.filter(row => row[FIELD.Type] === STORE.Comment)
		.forEach(row => {
			switch (row[FIELD.Key] as TComment) {
				case 'words':
					COMMENT.words = row.value;
					break;
				case 'patterns':
					COMMENT.patterns = row.value;
					break;
			}
		})
}