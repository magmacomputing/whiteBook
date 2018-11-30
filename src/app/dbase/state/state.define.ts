import { Observable } from 'rxjs';

import { IAuthState } from './auth.define';
import { STORE } from '@dbase/data/data.define';
import { IStateSlice } from './slice.define';
import { IDefault, IProfilePlan, IProfilePref, IPrice, IPlan, IPayment, IAttend, ISchedule, IClass, IEvent, ICalendar, ILocation, IInstructor, IProfileInfo, IStoreMeta } from '@dbase/data/data.schema';

export interface IState { [slice: string]: Observable<IStateSlice<IStoreMeta>> };

export interface IUserState {
	auth: IAuthState;
}

export interface IMemberState extends IUserState {
	member: {
		plan: IProfilePlan[];              	// member's effective plan
		info: IProfileInfo[];              	// array of AdditionalUserInfo documents
		pref: IProfilePref[];								// member's preferences
		price: IPrice[];                   	// member's effective prices
	},
	default: {
		[STORE.default]: IDefault[];        // defaults to apply, if missing from Member data
	}
}

export interface IPlanState extends IMemberState {
	client: {
		plan: IPlan[];                      // array of effective Plan documents
		price: IPrice[];                    // array of effective Price documents
	}
}

interface ISummary {
	paid: number;
	bank: number;
	pend: number;
	spend: number;
}
export interface IAccountState extends IMemberState {
	account: {
		payment: IPayment[];								// array of open payment documents, sorted by <stamp>
		attend: IAttend[];
		summary: ISummary;
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