import { WhereFilterOp, FieldPath } from '@firebase/firestore-types';

/** Query.where */
export interface IWhere {
	fieldPath: string | FieldPath;
	opStr: WhereFilterOp | '!=';				// this is a *special* to allow additional operator (do not pass to Firestore!)
	value: any | any[];
}
/** Query.orderBy */
export interface IOrderBy {
	fieldPath: string | FieldPath;
	directionStr?: 'desc' | 'asc' | undefined;
}
/** Collection.Query */
export interface IQuery {
	where?: IWhere | IWhere[];
	orderBy?: IOrderBy | IOrderBy[];
	limitTo?: number;
}