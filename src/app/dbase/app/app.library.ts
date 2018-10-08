import { TWhere } from '@dbase/fire/fire.interface';
import { FIELD } from '@dbase/data/data.define';
import { IMeta } from '@dbase/data/data.schema';

import { getStamp } from '@lib/date.library';
import { isString, isUndefined, isArray, isNumber } from '@lib/type.library';
import { IObject, cloneObj } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { toLower } from '@lib/string.library';

/**
 * apply Firestore-like filters to an Array.  
 * each row in the table must match all the filters to be selected.  
 * each field must match at least one of the filter-values to be selected.  
 * 
 * eg.[	{ fieldPath: 'store', opStr: '==', value: 'price' },  
 * 			{ fieldPath: 'type', opStr: '==' value: ['full','half'] }
 * 		]  
 * returns only rows with store= 'price', and with type= 'full' or 'half'
 */
export const filterTable = <T>(table: T[] = [], filters: TWhere = []) => {
	return cloneObj(table) 															// clone to avoid mutating original array
		.filter((row: IObject<any>) => {									// for each row, ...
			return asArray(filters)													// 	apply each filter...
				.every(clause => {														//	and return only rows that match every clause
					const key = row[clause.fieldPath.toString()];
					const operand = clause.opStr || '==';				// default to 'equals'
					const field = isString(key)
						? key.toLowerCase()												// string to lowercase to aid matching
						: isArray(key) && key.every(isString)
							? key.map(toLower)											// string[] to lowercase
							: key;

					return asArray(clause.value).map(value => {	// each value logically OR-ed to see if at-least one match
						const compare = toLower(value);

						switch (operand) {												// standard firestore query-operators, and '!='
							case '==':
								return isUndefined(field)
									? !compare													// if field not present, compare to 'falsy'
									: field == compare;									// use '==' to allow for string/number match, instead of '==='
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
							case '!=':															// non-standard operator
								return isUndefined(field) || field != compare;
							default:
								return false;
						}
					}).includes(true);													// true if at least-one value matches a particular clause
				})
		})
}

/**
 * Search an array, returning rows that match all the conditions *and* were active on the 'date'
 * where the rows are greater-than-or-equal to the date, or less-than the date
 * @param table		The table-array to search
 * @param cond 		condition to use as filter
 * @param date 		The date to use when determining which table-rows were effective at that time, default 'today'
 */
export const asAt = <T>(table: T[], cond: TWhere = [], date?: string | number) => {
	const stamp = isNumber(date) ? date : getStamp(date);

	return filterTable(cloneObj(table), cond)						// return the rows where date is between _effect and _expire
		.filter((row: IMeta) => stamp < (row[FIELD.expire] || Number.MAX_SAFE_INTEGER))
		.filter((row: IMeta) => stamp >= (row[FIELD.effect] || Number.MIN_SAFE_INTEGER))
}