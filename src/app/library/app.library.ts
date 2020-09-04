import { TWhere } from '@dbase/fire/fire.interface';
import { FIELD } from '@dbase/data/data.define';
import type { Meta } from '@dbase/data/data.schema';

import { getStamp, TInstant, Instant } from '@library/instant.library';
import { isString, isUndefined, isArray } from '@library/type.library';
import { getPath, cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { toLower } from '@library/string.library';
import { asTime } from '@library/number.library';

/**
 * apply filters to an array (table) of objects (rows).  
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
export const filterTable = <T>(table: T[] = [], filters: TWhere = []) => {
	const clone = cloneObj(table);												// clone to avoid mutating original array

	return clone
		.filter((row: Record<string, any>) => {						// for each row, ...
			return asArray(filters)													// 	apply each filter...
				.every(clause => {														//	and return only rows that match every clause
					const key = getPath(row, clause.fieldPath.toString()) as any;
					const operand = clause.opStr || '==';				// default to 'equals'
					const field = isString(key)
						? key.toLowerCase()												// string to lowercase to aid matching
						: isArray<any>(key) && key.every(isString)
							? key.map(toLower)											// string[] to lowercase
							: key

					return (isUndefined(clause.value) ? [undefined] : asArray(clause.value))
						.map(value => {														// each value logically OR-ed to see if at-least one match
							const compare = toLower(value);

							switch (operand) {											// standard firestore query-operators, and '!='
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
								case '!=':														// non-standard operator
									return (isUndefined(field) && !isUndefined(compare)) || field != compare;
								default:
									return false;
							}
						}).includes(true);												// true if at least-one value matches a particular clause
				})
		})
}

export const firstRow = <T>(table: T[] = [], filters: TWhere = []) =>
	filterTable<T>(table, filters)[0] || {} as T;

/**
 * Search an array, returning a single row that matches the cond,  
 * and was in-effect on date,  
 * and is nearest in time to near.  
 * e.g. near = {start: '19:30'}   will return the table-row whose 'start' field is nearest to '19:30'
 */
export const nearAt = <T>(table: T[] = [], cond: TWhere = [], date: TInstant = new Instant(), near: Partial<T>) => {
	const [key, hhmi] = Object.entries(near)[0];		// use first key to determine which field we compare
	const time = asTime(hhmi as string | number);		// convert HH:MM  to HHMM

	return asAt<T>(table, cond, date)
		.reduce((prev, curr, idx, arr) => {
			if (arr.length <= 1)
				return curr;															// no 'near' comparison needed

			const fld1 = (curr as T & { [key: string]: string | number })[key];
			const fld2 = (prev as T & { [key: string]: string | number })[key];

			return Math.abs(asTime(fld1) - time) < Math.abs(asTime(fld2) - time)
				? curr
				: prev
		},
			{ [key]: 0 } as T & { [key: string]: number })
}

/**
 * Search an array, returning rows that match all the conditions *and* were in-effect on the 'date'
 * (i.e. where the rows are greater-than-or-equal to the date, or less-than the date)
 * @param table		The table-array to search
 * @param cond 		condition to use as filter
 * @param date 		The date to use when determining which table-rows were effective at that time, default 'today'
 */
export const asAt = <T>(table: T[], cond: TWhere = [], date?: TInstant) => {
	const stamp = getStamp(date);

	return filterTable(table as (T & Meta)[], cond)		// return the rows where date is between _effect and _expire
		.filter(row => stamp < (row[FIELD.expire] || Number.MAX_SAFE_INTEGER))
		.filter(row => stamp >= (row[FIELD.effect] || Number.MIN_SAFE_INTEGER))
		.filter(row => !row[FIELD.hidden])								// discard rows that should not be visible
		.map(row => row as T)
}
