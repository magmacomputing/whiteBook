import { IWhere } from "@dbase/fire/fire.interface";
import { cloneObj, asArray, isString, isUndefined } from "@lib/object.library";

/** filter an Array to meet the supplied conditions, logically ANDed */
export const filterArray = <T>(table: T[] = [], cond: IWhere | IWhere[] = []) => {
	let lookup = cloneObj(table);														// clone the table argument, so we dont mutate it

	console.log('lookup: %j, %j', lookup, cond);
	asArray(cond)																						// cast cond as an array
		.forEach(clause => lookup = lookup.filter((row: any) => {
			console.log('clause: ', clause);
			const key = row[clause.fieldPath as string];
			const field = isString(key) ? key.toLowerCase() : key;
			const value = isString(clause.value) ? clause.value.toLowerCase() : clause.value;
			console.log('field: %s, %s, %s, %s', key, field, value, field == value);
			switch (clause.opStr) {															// standard firestore query-operators, and '!='
				case '==':
					return field == value;													// use '==' to allow for string/number match, instead of '==='
				case '>':
					return field > value;
				case '>=':
					return field >= value;
				case '<':
					return field < value;
				case '<=':
					return field <= value;
				case '!=':																				// non-standard operator
					return isUndefined(field) || field != value;
				default:
					return false;
			}
		}))

	return lookup;
}