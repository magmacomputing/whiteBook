import { WhereFilterOp, Query } from '@firebase/firestore-types';
import { IQuery, IWhere } from '@dbase/data/fire.interface';

import { asArray } from '@lib/object.library';
import { isNumeric } from '@lib/string.library';

/** Collection reference, with any limit / order criteria */
export const fnQuery = (query: IQuery = {}) => {
	return (colRef: Query) => {															// return a Query-function
		if (query.where)
			asArray<IWhere>(query.where)
				.forEach(qry => colRef = colRef.where(qry.fieldPath, qry.opStr as WhereFilterOp, qry.value));

		if (query.orderBy)
			asArray(query.orderBy)
				.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

		if (isNumeric(query.limitTo))
			colRef = colRef.limit(query.limitTo as number);

		return colRef;
	}
}
