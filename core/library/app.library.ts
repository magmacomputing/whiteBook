import { FIELD } from '@dbase/data.define';
import type { FireDocument } from '@dbase/data.schema';
import type { fire } from '@dbase/fire/fire.library';

import { getInstant, getStamp, Instant } from '@library/instant.library';
import { isString, isUndefined, isArray, isNullish, isDefined } from '@library/type.library';
import { getPath, cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { toLower } from '@library/string.library';
import { asTime } from '@library/number.library';

/**
 * apply filters (columns) to an array (table) of objects (rows).  
 * each row in the table must match all the filters to be selected.  
 * each field must match at least one of the filter-values to be selected.  
 * 
 * for example, a table with the following filters
 * ~~~~
 * [
 *  { fieldPath: 'store', opStr: '==', value: 'price' },  
 *  { fieldPath: 'type',  opStr: 'in', value: ['full','half'] }
 * ]
 * ~~~~ 
 * returns only rows with store= 'price', and with type= 'full' or 'half'
 */
export const filterTable = <T>(table: T[] = [], filters: fire.Query["where"] = []) => {
	const clone = cloneObj(table);												// clone to avoid mutating original array

	return clone
		.filter((row: Record<string, any>) => {						// for each row, ...
			return asArray(filters)													// 	apply each filter...
				.every(clause => {														//	and return only rows that match every clause
					const key = getPath<any>(row, clause.fieldPath.toString());
					const operand = clause.opStr ?? '==';				// default to 'equals'
					let field: any;

					switch (true) {
						case isString(key):
							field = key.toLowerCase();							// string to lowercase to aid matching
							break;
						case isArray(key) && key.every(isString):	// string[] to lowercase
							field = key.map(toLower);
							break;
						default:
							field = key;
							break;
					}

					return (isUndefined(clause.value) ? [undefined] : asArray(clause.value))
						.map(value => {														// each value logically OR-ed to see if at-least one match
							const compare = toLower(value);

							switch (operand) {											// standard firestore query-operators
								case '==':
								case 'in':
									return isUndefined(field)
										? !compare												// if field not present, compare to 'false-y'
										: field == compare;								// use '==' to allow for string/number match, instead of '==='
								case '>':
									return field > compare;
								case '>=':
									return field >= compare;
								case '<':
									return field < compare;
								case '<=':
									return field <= compare;
								case 'array-contains':
									return field.includes(compare);
								case 'not-in':
									return isUndefined(field) || !field.includes(compare);
								case '!=':
									return (isUndefined(field) && !isUndefined(compare)) || field != compare;
								default:
									return false;
							}
						}).includes(true);												// true if at least-one value matches a particular clause
				})
		})
}

export const firstRow = <T>(table: T[] = [], filters: fire.Query["where"] = []) =>
	filterTable<T>(table, filters)[0] || {} as T;

/**
 * Search an array, returning a single row that matches the cond,  
 * 	and was in-effect on date,  
 * 	and is nearest in time to \<near>  
 *  else isEmpty().  
 * e.g. near = {start: '19:30'}   will return the table-row whose \<start> field is nearest to '19:30'
 */
export const nearAt = <T>(table: T[] = [], cond: fire.Query["where"] = [], date: Instant.TYPE = new Instant(), near: Partial<T>) => {
	const [key, hhmi] = Object.entries(near)[0];		// use first key to determine which field we compare
	const time = asTime(hhmi as string | number);		// convert HH:MM  to HHMM

	if (isUndefined(key))
		throw new Error(`No key-field detected: (eg. {[key]: '19:30'})`);
	if (isUndefined(hhmi))
		throw new Error(`No time-field detected: (eg. {[key]: '19:30'})`);

	return asAt<T>(table, cond, date)
		.reduce((prev, curr, idx, arr) => {
			if (arr.length <= 1)
				return curr;															// no 'near' comparison needed

			const fld1 = getPath<string | number>(prev, key, 0);
			const fld2 = getPath<string | number>(curr, key, 0);

			return Math.abs(asTime(fld1) - time) < Math.abs(asTime(fld2) - time)
				? prev
				: curr
		}, {} as T)
}

/**
 * Search an array, returning rows that match all the conditions *and* were in-effect on the 'date'
 * (i.e. where the rows are greater-than-or-equal to the date, or less-than the date)
 * @param table		The table-array to search
 * @param cond 		condition to use as filter
 * @param effect	The date to use when determining which table-rows were effective at that time, default 'today'
 * @param expire	The date to use when determining upper-limit of effective dates, default 'effect'
 */
export const asAt = <T>(table: T[], cond: fire.Query["where"] = [], effect?: Instant.TYPE, expire?: Instant.TYPE) => {
	const stampStart = getStamp(effect);
	const stampUntil = isNullish(expire) ? stampStart : getStamp(expire);

	return filterTable(table as (T & FireDocument)[], cond)		// return the rows where date is between _effect and _expire
		.map(row => {
			if (isDefined(row[FIELD.Expire]) && row[FIELD.Expire] === row[FIELD.Effect])
				row[FIELD.Expire] = getInstant(row[FIELD.Effect]).add(1, 'day').startOf('day').ts;
			return row;
		})
		.filter(row => stampUntil < (row[FIELD.Expire] || Number.MAX_SAFE_INTEGER))
		.filter(row => stampStart >= (row[FIELD.Effect] || Number.MIN_SAFE_INTEGER))
		.filter(row => !row[FIELD.Hidden])											// discard rows that should not be visible
		.map(row => row as T)
}
