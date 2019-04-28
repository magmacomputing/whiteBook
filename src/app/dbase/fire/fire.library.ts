import * as firebase from 'firebase/app';
import { Query, FieldPath, QueryFn } from '@angular/fire/firestore';
import { IQuery, IWhere } from '@dbase/fire/fire.interface';

import { asArray, cartesian, distinct } from '@lib/array.library';
import { isNumeric } from '@lib/string.library';
import { isUndefined } from '@lib/type.library';

/** Array of Query Functions with any limit / order criteria.  
 * If a Where-clause contains an array of <values>, this indicates a logical-or,
 * and needs to be split into separate Queries, as Firestore does not currently
 * 'or' in a single-query
 */
export const fnQuery = (query: IQuery = {}) => {
	return splitQuery(query)
		.map<QueryFn>(split =>
			(colRef: Query) => {													// map a Query-function
				if (split.where)
					asArray(split.where)
						.filter(qry => !isUndefined(qry.value))	// discard queries for 'undefined' value
						.forEach(qry => colRef = colRef.where(qry.fieldPath, (qry.opStr || '==') as firebase.firestore.WhereFilterOp, qry.value));

				if (split.orderBy)
					asArray(split.orderBy)
						.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

				if (isNumeric(split.limit))
					colRef = colRef.limit(split.limit);

				if (split.startAt)
					colRef = colRef.startAt(split.startAt);

				if (split.startAfter)
					colRef = colRef.startAfter(split.startAfter);

				if (split.endAt)
					colRef = colRef.endAt(split.endAt);

				if (split.endBefore)
					colRef = colRef.endBefore(split.endBefore);

				return colRef;
			}
		)
}

// TODO: consider split on fieldPath as well?
/**
 * create a set of Query-clauses to split the logical-or criteria.  
 * for example {fieldPath: 'uid', value: ['abc','def']} will return an array of
 * [ {fieldPath:'uid', value:'abc'}, {fieldPath:'uid', value'def'} ]
 */
const splitQuery = (query: IQuery = {}) => {
	const vals = asArray(query.where)							// for each 'where' clause
		.map(where => asArray(where.value)					// for each 'value'
			.distinct<any>()													// remove duplicates
			.map(value => ({													// build an array of separate IWhere
				fieldPath: where.fieldPath,
				opStr: where.opStr,
				value: value,
			}))
		);

	// .map(where => asArray(where.value)					// for each 'value'
	// 	.distinct()
	// 	.map<IWhere>(value =>											// build an array of separate IWhere
	// 		({
	// 			fieldPath: where.fieldPath,
	// 			opStr: where.opStr,
	// 			value: value,
	// 		})
	// 	)
	// );
	const wheres: IWhere[] = cartesian(...vals) || [];// cartesian product of IWhere array
	const split: IQuery[] = wheres.map(where =>		// for each split IWhere
		({																					// build an array of IQuery
			orderBy: query.orderBy,
			limitTo: query.limit,
			startAt: query.startAt,
			startAfter: query.startAfter,
			endAt: query.endAt,
			endBefore: query.endBefore,
			where: where,
		})
	)

	return split.length ? split : asArray(query);	// if no Where, return array of original Query
}

/** Make a 'where' clause */
export const addWhere = (fieldPath: string | FieldPath, value: any, opStr: IWhere["opStr"] = '==') => {
	const where: IWhere = { fieldPath, value };
	if (opStr) where.opStr = opStr;
	return where;
}