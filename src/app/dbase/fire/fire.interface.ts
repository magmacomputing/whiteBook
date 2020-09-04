import { FIELD } from '@dbase/data/data.define';

export type TWhere = FireWhere | FireWhere[];

/** Query.where */
export interface FireWhere {
	fieldPath: string | firebase.firestore.FieldPath;
	opStr?: firebase.firestore.WhereFilterOp | '!=';				// this is a *special* to allow additional local operator (do not use on Cloud Firestore queries!)
	value: any | any[];
}

/** Query.orderBy */
export interface FireOrderBy {
	fieldPath: string | firebase.firestore.FieldPath;
	directionStr?: firebase.firestore.OrderByDirection;
}

/** Collection.Query */
export interface FireQuery {
	where?: FireWhere | FireWhere[];
	orderBy?: FireOrderBy | FireOrderBy[];
	limit?: number;
	startAt?: string;
	startAfter?: string;
	endAt?: string;
	endBefore?: string;
}

/** FirestoreFunction getMeta() */
export interface DocMeta {
	[FIELD.id]: string;
	[FIELD.create]?: number;
	[FIELD.update]?: number;
	[FIELD.access]?: number;
	exists: boolean;
	path: string;
	parent: string;
	subcollections?: string[];
}