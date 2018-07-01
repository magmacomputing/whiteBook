// import { Injectable } from '@angular/core';
// import { Store } from '@ngxs/store';

// import { IMeta } from '@dbase/app/app.interface';
// import { IWhere } from '@dbase/fire/fire.interface';
// import { FIELD } from '@dbase/fire/fire.define';

// import { isNumber, isUndefined, isString, cloneObj, asArray } from '@lib/object.library';
// import { fmtDate } from '@lib/date.library';
// import { DATE_FMT } from '@lib/date.define';
// import { dbg } from '@lib/logger.library';

// // import { AuthState, IAuthState } from '@svc/state/auth.state';

// // import { IMeta, IProfilePlan, IProfile, IPrice, IClass, IClient } from '@svc/app/app.interface';
// // import { IAppDefault, IPriceDefault, ITopUpDefault } from '@svc/app/app.interface';
// // import { FIELD } from '@svc/fire/fire.define';
// // import { IWhere } from '@svc/fire/fire.interface';

// // import { DATE_FMT } from '@lib/date.define';
// // import { fmtDate } from '@lib/date.library';
// // import { cloneObj, isArray, isObject, isString, isUndefined, isNumber } from '@lib/object.library';
// // import { dbg } from '@lib/log.library';
// // import { TTokenClaims } from '@app/service/auth/auth.interface';

// // // Library of functions to manage the Member Logic
// @Injectable()//{ providedIn: DBaseModule })
// export class MemberLibrary {
// 	private dbg: Function = dbg.bind(this);

// 	// 	public client!: IClient[];

// 	constructor(private store: Store) { }
// 	// 		this.APP_DEFAULT = [											// TODO: a mini-table to use for Default values
// 	// 			{ type: 'price', [FIELD.expire]: 0, plan: 'member', class: 'full', amount: -1, },
// 	// 			{ type: 'topUp', [FIELD.expire]: 0, plan: 'member', amount: -1 },
// 	// 		]
// 	// 		this.client = [];
// 	// 	}

// 	// 	public getStore<T>(store: string) {
// 	// 		return this.client
// 	// 			.filter(row => row.store === store) as T[]
// 	// 	}

// 	/**
// 	 * Search an array, returning rows that match all the 'conditions' and were effective on the 'date'
// 	 * @param table		The table-array to search
// 	 * @param cond 		condition to use as filter
// 	 * @param date 		The date to use when determining which table-row was effective at that time
// 	 */
// 	asAt(table: T[], cond: IWhere | IWhere[] = [], date?: string | number) => {
// 	const stamp = isNumber(date) ? date : fmtDate(date, DATE_FMT.yearMonthDayFmt).stamp;

// 	return this.filterArray(table, cond)													// return the rows where date is between _effect and IMeta
// 		.filter(row => stamp < (row[FIELD.expire] || Number.MAX_SAFE_INTEGER))
// 		.filter(row => (row[FIELD.effect] || Number.MIN_SAFE_INTEGER) <= stamp)
// }

// async getUid(uid ?: string) => {
// 	if (isUndefined(uid)) {
// 		return this.store
// 			.selectOnce(AuthState)
// 			.toPromise<IAuthState>()
// 			.then(auth => auth.userInfo && auth.userInfo.uid || '')
// 	}
// 	return uid;
// }

// /**
//  * Determine what price was in effect, given the Member's Plan-type, Event-name and Date.
//  * A price is determined by a Member's
//  * -> 'Plan'	(which names the pricing per Event-type)
//  * -> 'Event' (which names the class)
//  * -> 'Date'	(because Plan-pricing changes over time)
//  * @param event 	The name of the Event that was attended
//  * @param uid			The uid of the Member
//  * @param date 		The date to use when determining which Price-row was effective at that time
//  */
// getPrice = async (event: string, uid?: string, date?: string | number, debug?: boolean) => {
// 	let where: IWhere | IWhere[];
// 	// TODO: fetch arrays from ngxs/store
// 	const [user_id, profile, classes, prices] = await Promise.all([
// 		this.getUid(uid),
// 		[] as IProfile[],
// 		[] as IClass[],
// 		[] as IPrice[],
// 	])

// 	// get the Application Pricing defaults as-at the Date
// 	where = { fieldPath: 'type', opStr: '==', value: 'price' };
// 	const defaultPrice = this.asAt(this.APP_DEFAULT, where, date)[0] as IPriceDefault;
// 	if (debug) this.dbg('defaultPrice: %j', defaultPrice);

// 	// what plan was in effect for this Member as-at the Date?
// 	where = [{ fieldPath: 'type', opStr: '==', value: 'plan' }, { fieldPath: 'uid', opStr: '==', value: user_id }];
// 	const profileRow = this.asAt(profile, where, date)[0] as IProfilePlan;
// 	const plan = profileRow && profileRow.plan || defaultPrice.plan;
// 	if (debug) this.dbg('profileRow: %j', profileRow);

// 	// what type of class pricing (eg. 'half', 'full') was in effect as-at the Date?
// 	where = { fieldPath: 'name', opStr: '==', value: event }
// 	const classRow = this.asAt(classes, where, date)[0];
// 	const type = classRow && classRow.type || defaultPrice.class;
// 	if (debug) this.dbg('classRow: %j', classRow);

// 	// what price for this plan and class-type was in effect as-at the Date?
// 	where = [{ fieldPath: 'plan', opStr: '==', value: plan }, { fieldPath: 'type', opStr: '==', value: type }];
// 	const priceRow = this.asAt(prices, where, date)[0];
// 	const price = priceRow && !isUndefined(priceRow.amount) ? priceRow.amount : defaultPrice.amount;
// 	if (debug) this.dbg('priceRow: %j', priceRow);

// 	return { plan, type, price, }
// }

// // 	/** a TopUp amount depends on whatever Plan was active for a Member on a given date */
// // 	getTopUp = async (uid?: string, date?: string | number, debug?: boolean) => {
// // 		let where: IWhere | IWhere[];
// // 		// TODO: fetch arrays from nxgs/store
// // 		const [user_id, profile, prices] = await Promise.all([
// // 			this.getUid(uid),
// // 			[] as IProfile[],
// // 			[] as IPrice[],
// // 		])

// // 		// get the Application Pricing defaults as-at the Date
// // 		where = { fieldPath: 'type', opStr: '==', value: 'topUp' };
// // 		const defaultTopUp = this.asAt(this.APP_DEFAULT, where, date)[0] as ITopUpDefault;
// // 		if (debug) this.dbg('defaultTopUp: %j', defaultTopUp);

// // 		// what plan was in effect for this Member as-at the Date?
// // 		where = [{ fieldPath: 'type', opStr: '==', value: 'topUp' }, { fieldPath: 'uid', opStr: '==', value: user_id }];
// // 		const profileRow = this.asAt(profile, where, date)[0] as IProfilePlan;
// // 		const plan = profileRow && profileRow.plan || defaultTopUp.plan;
// // 		if (debug) this.dbg('profileRow: %j', profileRow);

// // 		// what topUp for this plan was in effect as-at the Date?
// // 		where = [{ fieldPath: 'type', opStr: '==', value: 'topUp' }, { fieldPath: 'plan', opStr: '==', value: plan }];
// // 		const priceRow = this.asAt(prices, where, date)[0];
// // 		const topUp = priceRow && !isUndefined(priceRow.amount) ? priceRow.amount : defaultTopUp.amount;
// // 		if (debug) this.dbg('priceRow: %j', priceRow);

// // 		return { plan, topUp }
// // 	}
// // }
// }