import { WhereFilterOp, Query } from '@firebase/firestore-types';
import { IQuery, IWhere, IOrderBy } from '@dbase/fire/fire.interface';

import { isObject } from '@lib/object.library';
import { isNumeric } from '@lib/string.library';

/** Collection reference, with any limit / order criteria */
export const fnQuery = (query: IQuery = {}) => {
	return (colRef: Query) => {										// return a Query-function
		if (query.where) {
			let where: IWhere[] = isObject(query.where)
				? [query.where as IWhere]								// coerce into Array
				: query.where as IWhere[]
			where.forEach(qry => colRef = colRef.where(qry.fieldPath, qry.opStr as WhereFilterOp, qry.value));
		}

		if (query.orderBy) {
			let orderBy: IOrderBy[] = isObject(query.orderBy)
				? [query.orderBy as IOrderBy]
				: query.orderBy as IOrderBy[]
			orderBy.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));
		}

		if (isNumeric(query.limitTo))
			colRef = colRef.limit(query.limitTo as number);

		return colRef;
	}
}
