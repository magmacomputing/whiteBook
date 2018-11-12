import { Observable } from 'rxjs';
import { TTokenClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IPrice, IDefault, IPlan, IPayment, IAttend, ISchedule, IClass, IEvent, ICalendar, ILocation, IInstructor, IMemberInfo } from '@dbase/data/data.schema';

export interface IState { [slice: string]: Observable<any> };

export interface IUserState {
	auth: {
		user: {                             // generic information returned from a Provider
			uid: string;
			providerId: string;
			displayName: string | null;
			email: string | null;
			photoURL: string | null;
		} | null;
		claims: TTokenClaims | null;        // authenticated customClaims
	}
}

export interface IMemberState extends IUserState {
	member: {
		plan?: IProfilePlan[];              // member's effective plan
		price?: IPrice[];                   // member's effective prices
		info?: IMemberInfo[];              	// array of AdditionalUserInfo documents
	}
	defaults?: IDefault[];                // defaults to apply, if missing from Member data
}

export interface IPlanState extends IMemberState {
	client: {
		plan: IPlan[];                      // array of effective Plan documents
		price: IPrice[];                    // array of effective Price documents
	}
}

interface ISummary {
	pay: number;
	bank: number;
	pend: number;
	cost: number;
}
export interface IAccountState extends IMemberState {
	account: {
		payment: IPayment[];								// array of active payment documents
		attend: IAttend[];
		summary: ISummary;
		active: string[];										// the currently 'active' IPayment row
	}
}

export interface ITimetableState extends IMemberState {
	client: {
		schedule?: ISchedule[];
		class?: IClass[];
		event?: IEvent[];
		calendar?: ICalendar[];
		location?: ILocation[];
		instructor?: IInstructor[];
		price?: IPrice[];
	}
}