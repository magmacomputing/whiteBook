import { IWhere } from "@dbase/fire/fire.interface";
import { asArray, isString, isUndefined, IObject } from "@lib/object.library";

/** filter a Table-array to meet the supplied conditions, logically ANDed */
export const filterTable = <T>(table: T[] = [], filters: IWhere | IWhere[] = []) => {
	return table
		.filter((row: IObject<any>) => {													// for each row, ...
			return asArray(filters)																	// 	apply each filter...
				.every(clause => {																		//	and return only rows that match every clause
					const key = row[clause.fieldPath as string];
					const field = isString(key) ? key.toLowerCase() : key;
					const value = isString(clause.value) ? clause.value.toLowerCase() : clause.value;

					switch (clause.opStr) {															// standard firestore query-operators, and '!='
						case '==':
							return isUndefined(field)
								? !value																			// if field not present, compare to 'falsy'
								: field == value;															// use '==' to allow for string/number match, instead of '==='
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
				})
		})
}