import { FIELD } from '@dbase/data/data.define';

export type TWhere = IWhere | IWhere[];

/** Query.where */
export interface IWhere {
	fieldPath: string | firebase.firestore.FieldPath;
	opStr?: firebase.firestore.WhereFilterOp | '!=';				// this is a *special* to allow additional local operator (do not use on Cloud Firestore queries!)
	value: any | any[];
}
/** Query.orderBy */
export interface IOrderBy {
	fieldPath: string | firebase.firestore.FieldPath;
	directionStr?: firebase.firestore.OrderByDirection;
}
/** Collection.Query */
export interface IQuery {
	where?: IWhere | IWhere[];
	orderBy?: IOrderBy | IOrderBy[];
	limit?: number;
	startAt?: string;
	startAfter?: string;
	endAt?: string;
	endBefore?: string;
}

/** FirestoreFunction getMeta() */
export interface IDocMeta {
	[FIELD.id]: string;
	[FIELD.create]?: number;
	[FIELD.update]?: number;
	[FIELD.access]?: number;
	subcollections: string[];
	exists: boolean;
	path: string;
}