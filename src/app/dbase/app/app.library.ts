import { IWhere } from '@dbase/fire/fire.interface';
import { asArray, isString, isUndefined, IObject } from '@lib/object.library';

/** filter a Table-array to meet the supplied conditions, logically ANDed */
export const filterTable = <T>(table: T[] = [], filters: IWhere | IWhere[] = []) => {
	return table
		.filter((row: IObject<any>) => {													// for each row, ...
			return asArray(filters)																	// 	apply each filter...
				.every(clause => {																		//	and return only rows that match every clause
					const key = row[clause.fieldPath as string];
					const field = isString(key) ? key.toLowerCase() : key;
					const values = asArray(clause.value);

					return values.map(value => {												// logically OR each value to see if at-least one match
						const compare = isString(value) ? value.toLowerCase() : value;
						let match: boolean = false;

						switch (clause.opStr) {														// standard firestore query-operators, and '!='
							case '==':
								match = isUndefined(field)
									? !compare																	// if field not present, compare to 'falsy'
									: field == compare;													// use '==' to allow for string/number match, instead of '==='
								break;
							case '>':
								match = field > compare;
								break;
							case '>=':
								match = field >= compare;
								break;
							case '<':
								match = field < compare;
								break;
							case '<=':
								match = field <= compare;
								break;
							case '!=':																			// non-standard operator
								match = isUndefined(field) || field != compare;
								break;
							default:
								match = false;
								break;
						}
						return match;
					}).includes(true);																	// true if at least-one value matches a particular clause
				})
		})
}