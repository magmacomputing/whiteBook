import { Subscription } from "rxjs";
import { DocumentChangeAction } from "angularfire2/firestore";

export interface IListen {
	slice: string;
	next?: (value: DocumentChangeAction<{}>[]) => void;
	subscribe: Subscription;
};