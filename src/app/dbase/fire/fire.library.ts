import { Query, WhereFilterOp, FirebaseFirestore } from '@firebase/firestore-types';
import { AngularFirestoreCollection } from 'angularfire2/firestore';
import { IQuery, IWhere, IOrderBy } from '@app/dbase/fire/fire.interface';

import { getType } from '@lib/object.library';
import { isNumeric } from '@lib/string.library';

/** Collection reference, with any limiting criteria */
export function fnQuery(query: IQuery = {}) {
	return (colRef: Query) => {										// return a Query-function
		if (query.where) {
			let where: IWhere[] = getType(query.where) === 'Object'
				? [query.where as IWhere]								// coerce into Array
				: query.where as IWhere[]
			where.forEach(qry => colRef = colRef.where(qry.fieldPath, qry.opStr as WhereFilterOp, qry.value));
		}

		if (query.orderBy) {
			let orderBy: IOrderBy[] = getType(query.orderBy) === 'Object'
				? [query.orderBy as IOrderBy]
				: query.orderBy as IOrderBy[]
			orderBy.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));
		}

		if (isNumeric(query.limitTo))
			colRef = colRef.limit(query.limitTo as number);

		return colRef;
	}
}
