import { Observable } from 'rxjs';

import { IAuthState } from './auth.define';
import { STORE } from '@dbase/data/data.define';
import { IConfig, IDefault, IProfilePlan, IPrice, IPlan, IPayment, IAttend, ISchedule, IClass, IEvent, ICalendar, ILocation, IInstructor, IMemberInfo } from '@dbase/data/data.schema';

export interface IState { [slice: string]: Observable<any> };

export interface IUserState {
	auth: IAuthState;
}

export interface IConfigState {
	[STORE.config]: IConfig[];
	[STORE.default]: IDefault[];
}

export interface IMemberState extends IUserState {
	member: {
		plan?: IProfilePlan[];              // member's effective plan
		price?: IPrice[];                   // member's effective prices
		info?: IMemberInfo[];              	// array of AdditionalUserInfo documents
	},
	default: {
		[STORE.default]: IDefault[];                // defaults to apply, if missing from Member data
	}
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