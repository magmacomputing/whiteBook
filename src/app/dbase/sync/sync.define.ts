import { Subscription } from "rxjs";

export interface IListen {
	slice: string;
	subscribe: Subscription;
};
