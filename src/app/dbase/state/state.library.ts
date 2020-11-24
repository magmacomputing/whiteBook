import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { fire } from '@dbase/fire/fire.library';
import { FireClaims } from '@service/auth/auth.interface';
import { calcBonus } from '@service/member/attend.library';
import { calcPayment, getMemberAge } from '@service/member/member.library';
import { SLICES, SORTBY } from '@dbase/state/config.define';

import type { FireDocument, Default, Class, Price, Event, Schedule, Span, ProfilePlan, Icon, Calendar, Account } from '@dbase/data.schema';
import { IState, AccountState, TimetableState, PlanState, SLICE, TStateSlice, ApplicationState, ProviderState } from '@dbase/state/state.define';
import { asAt, firstRow, filterTable } from '@library/app.library';
import { COLLECTION, STORE, FIELD, BONUS, PRICE, PLAN, SCHEDULE, auth, PAYMENT } from '@dbase/data.define';

import { asArray } from '@library/array.library';
import { getPath } from '@library/object.library';
import { Instant, getInstant } from '@library/instant.library';
import { isString, isArray, isFunction, isUndefined, isEmpty, nullToZero } from '@library/type.library';

/**
 * Generic Slice Observable
 */
export const getCurrent = <T>(states: IState, store: STORE, filter: fire.Query["where"] = [], date?: Instant.TYPE) => {
	const slice = getSlice(store);
	const state = states[slice] as Observable<FireDocument>;
	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(state => asAt<T>(state[store], filter, date)),
		map(table => table.sortBy(asArray(SORTBY[store])))
	)
}

/**
 * Get all documents by filter,  
 * do not exclude _expire unless <date> specified
 */
export const getStore = <T>(states: IState, store: STORE, filter: fire.Query["where"] = [], date?: Instant.TYPE) => {
	const slice = getSlice(store);
	if (store === slice.toString())													// top-level slice (eg. Attend)
		return getState<T>(states, store, filter, date);

	const state: Observable<TStateSlice<T>> = states[slice] as any;
	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(obs => isUndefined(date)
			? filterTable<T>(obs[store], filter)
			: asAt<T>(obs[store], filter, date)),
		map(table => table.sortBy(asArray(SORTBY[store]))),
	)
}
export const getState = <T>(states: IState, store: STORE, filter: fire.Query["where"] = [], date?: Instant.TYPE) => {
	const state: Observable<TStateSlice<T>> = states[store] as any;
	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	const res: T[] = []
	return state.pipe(
		map(obs => Object.keys(obs).map(list => res.concat(Object.values(obs[list]))).flat()),
		map(table => isUndefined(date) ? filterTable<T>(table, filter) : asAt<T>(table, filter, date)),
		map(table => table.sortBy(asArray(SORTBY[store]))),
	)
}

export const getSlice = (store: STORE) => {			// determine the state-slice based on the <store> field
	const slices = Object.keys(SLICES)
		.filter(key => SLICES[key as COLLECTION]!.includes(store));// find which slice holds the requested store

	if (isEmpty<object>(SLICES))									// nothing in State yet, on first-time connect
		slices.push(SLICE.client);									// special: assume 'client' slice.
	if (!SORTBY[store])
		SORTBY[store] = [FIELD.Sort, FIELD.Key];		// special: assume sort order

	if (!slices.length)
		alert(`Unexpected store: ${store}`)

	return slices[0] as COLLECTION;
}

/** find the default value for the requested type */
export const getDefault = (state: ApplicationState, type: string) => {
	const table = (state.application[STORE.Default])
		.filter(row => row[FIELD.Type] === type);

	return table.length && table[0][FIELD.Key] || undefined;
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: FireClaims) =>
	({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a document to other documents referenced by a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * node:   	the name of the node (eg. 'member') under which we place the documents on the Observable Object  
 * store:   the parent documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, node: string | undefined, store: STORE, filter: fire.Query["where"] = [], date?: Instant.TYPE, callBack?: CallableFunction) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, filter);						// loop through filters
				parent = data;                                        // stash the original parent data state

				return combineLatest(store === STORE.Attend
					? [getStore<FireDocument>(states, store, filters, date)]
					: [getCurrent<FireDocument>(states, store, filters, date)]
				);
			}),

			map(res => {
				if (store === STORE.Calendar && !isUndefined(date)) {	// special logic to filter Calendar
					const now = getInstant(date).ts;												// because it does not generally track _effect/_expire
					res[0] = (res[0] as Calendar[])
						.filter(row => now < (row[FIELD.Expire] || getInstant(row[FIELD.Key]).endOf('day').ts))
						.filter(row => now >= (row[FIELD.Effect] || getInstant(row[FIELD.Key]).ts))
				}

				const nodes = node && node.split('.') || [];					// specific branch on node
				let joins: Record<string, FireDocument[]> = nodes[0] && parent[nodes[0]] || {};

				res.forEach(table => {
					if (table.length) {
						table.forEach(row => {
							const type = (getSlice(store) === COLLECTION.Client)
								? (nodes[1] || row[FIELD.Store])
								: (nodes[1] || row[FIELD.Type] || row[FIELD.Store])

							joins[type] = joins[type] || [];
							joins[type] = joins[type].filter(item => item[FIELD.Id] !== row[FIELD.Id]);
							joins[type].push(row);
						})
					} else {
						const type = nodes[1] || store;
						joins[type] = joins[type] || [];									// if there are no documents that match the criteria, return empty array
					}
				})

				Object.keys(joins).map(table => {                     // apply any provided sortBy criteria
					if (isArray(joins[table]) && joins[table].length) {
						const store = joins[table][0][FIELD.Store];
						joins[table] = joins[table].sortBy(asArray(SORTBY[store]));
					}
				})

				return node
					? { ...parent, ...{ [nodes[0]]: joins } }
					: { ...parent, ...joins }
			}),

			map(data => isFunction(callBack) ? callBack(data) : data),
		)
	})
}

/**
 * A helper function to analyze the <value> field of each filter.  
 * If <value> isString and matches {{...}}, it refers to the current data in the <parent>
 */
const decodeFilter = (parent: any, filter: fire.Query["where"] = []) => {
	return asArray(filter).map(cond => {                      // loop through each filter
		cond.value = asArray(cond.value)
			.flatMap(value => {    																// loop through filter's <value>
				const isPath = isString(value) && value.startsWith('{{');
				let lookup = value;

				if (isPath) {                                       // check if is it a fieldPath reference on the parent
					const child = value.replace('{{', '').replace('}}', '').replace(' ', '');
					const dflt = child.split('.').reverse()[0];       // get the last component of the fieldPath
					const defaultValue = getDefault(parent, dflt);

					lookup = getPath(parent, child, defaultValue)			// accessor
					if (isArray(lookup))
						lookup = lookup.flat();													// flatten array of arrays																				
				}

				return lookup;                              				// rebuild filter's <value>
			})
			.distinct()																						// remove duplicates

		if (cond.value.length === 1)
			cond.value = cond.value[0];                           // an array of only one value; return as string

		return cond;                                            // rebuild each filter
	})
}

/**
 * Use the Observable on open Payment[] to determine current account-status (paid, pending, bank, adjusts, etc.).  
 * The Payment array is reverse-sorted by FIELD.stamp, meaning payment[0] is the earliest 'active' value.  
 * paid		: is amount from active payment, if topUp and approved  
 * adjust : is amount from active payment, if debit/credit  
 * bank		: is amount from unspent funds (brought forward from previous payment)  
 * pend 	: is amount from unapproved payments (not yet 'active')    
 * funds	: is amount remaining on active payment  
 * credit	: is amount remaining overall (i.e. including <pend>)
 */
export const sumPayment = (source: AccountState) => {
	if (source.account) {
		const sum: Account["summary"] = { paid: 0, bank: 0, adjust: 0, pend: 0, spend: 0, credit: 0, funds: 0 };

		source.account.payment = asArray(source.account.payment)
			.orderBy(FIELD.Stamp)
		source.account.summary = source.account.payment
			.reduce((sum, payment, indx) => {
				const amounts = calcPayment(payment);

				if (indx === 0) {																		// only 1st Payment
					sum.bank += nullToZero(payment.bank)
					sum.paid += amounts[PAYMENT.TopUp];
					sum.adjust += amounts[PAYMENT.Adjust];
				} else
					sum.pend += amounts[PAYMENT.TopUp] + amounts[PAYMENT.Adjust] + nullToZero(payment.bank);

				sum.credit = sum.bank + sum.paid + sum.adjust + sum.pend;
				sum.funds = sum.bank + sum.paid + sum.adjust;

				return sum;
			}, sum)
	}

	return { ...source };
}

/** Use the Observable on Attend[] to add-up the cost of the Classes on the active Payment */
export const sumAttend = (source: AccountState) => {
	if (source.account && isArray(source.account.attend)) {
		source.account.summary = source.account.attend
			.reduce((sum, attend) => {
				sum.spend += attend.payment.amount;
				sum.credit -= attend.payment.amount;
				sum.funds -= attend.payment.amount;
				return sum;
			}, source.account.summary)
	}

	return { ...source }
}

/** calc a 'day' field for a Calendar row */
export const calendarDay = (source: TimetableState) => {
	if (source.client.calendar) {
		source.client.calendar = source.client.calendar
			.map(row => ({ ...row, day: getInstant(row[FIELD.Key]).dow }))
	}
	return { ...source }
}

const lookupIcon = (source: any, key: string) => {
	const dflt = firstRow<Default>(source.application[STORE.Default], fire.addWhere(FIELD.Type, STORE.Icon))[FIELD.Key];
	return firstRow<Icon>(source.client.icon, fire.addWhere(FIELD.Key, [key, dflt])).image
};

/** Assemble a Provider-view */
export const buildProvider = (source: ProviderState) => {
	source.client.provider = source.client.provider.map(provider => {
		if (!provider.image)
			provider.image = lookupIcon(source, provider[FIELD.Key]);

		return provider;
	})

	return { ...source }
}

/** Assemble a Plan-view */
export const buildPlan = (source: PlanState) => {
	const roles = getPath<string[]>(source.auth, 'token.claims.claim.roles');
	const isAdmin = roles?.includes(auth.ROLE.Admin);
	const myPlan = firstRow<ProfilePlan>(source.member.plan, fire.addWhere(FIELD.Type, STORE.Plan));
	const myTopUp = firstRow<Price>(source.client.price, fire.addWhere(FIELD.Type, PRICE.TopUp));
	const myAge = getMemberAge(source.member.info);					// use birthDay from provider, if available

	source.client.plan = source.client.plan.map(plan => {   // array of available Plans
		const planPrice = firstRow<Price>(source.client.price, [
			fire.addWhere(FIELD.Key, plan[FIELD.Key]),
			fire.addWhere(FIELD.Type, PRICE.TopUp),
		])

		if (planPrice.amount < myTopUp.amount && !isAdmin)    // Special: dont allow downgrades in price
			plan[FIELD.Hisable] = true;

		if (plan[FIELD.Key] === PLAN.Intro)										// Special: Intro is only available to new Members
			plan[FIELD.Hidden] = (myPlan && !isAdmin) ? true : false;

		if (plan[FIELD.Key] === PLAN.Senior) {								// Special: Senior is only available to >=60 Member
			const notAllow = myAge < 60 && !isAdmin;						// check member is younger than 60 and not Admin
			plan[FIELD.Hidden] = notAllow;
			plan[FIELD.Hisable] = notAllow;
		}

		if (!plan[FIELD.Image])
			plan[FIELD.Image] = lookupIcon(source, plan[FIELD.Key]);

		if (myPlan && myPlan.plan === plan[FIELD.Key])	 			// disable their current Plan, so cannot re-select
			plan[FIELD.Hisable] = true;

		return plan
	});

	return { ...source }
}

/**
 * use the collected Schedule items to determine the Timetable to display.  
 * schedule type 'event' overrides 'class'; 'special' appends.  
 */
export const buildTimetable = (source: TimetableState, date?: Instant.TYPE, elect?: BONUS) => {
	const {
		schedule: times = [],												// the schedule for the requested date
		class: classes = [],    										// the classes offered on that date
		calendar = [],															// the calendar of special events on the date
		event: events = [],													// the event-description for the calendar type
		span: spans = [],														// the duration of classes / events
		location: locations = [],										// the locations of the classes / events
		alert: alerts = [],													// any alert notes for this date
		price: prices = [],													// the prices as per member's plan
		plan: plans = [],														// the plans for the Member
		bonus = [],																	// the bonus' for the Member
		icon: icons = [],														// the icons for classes offered on that date
	} = source.client;
	const attendToday = source[COLLECTION.Attend].attendToday;
	const icon = firstRow<Default>(source.application[STORE.Default], fire.addWhere(FIELD.Type, STORE.Icon));
	const locn = firstRow<Default>(source.application[STORE.Default], fire.addWhere(FIELD.Type, STORE.Location));
	const eventLocations: string[] = [];					// the locations at which a Special Event is running

	/**
	 * If we found any Calendar events, push them on the Timetable.  
	 * assume a Calendar's location overrides the usual Schedule at the location.
	 */
	calendar.forEach(calendarDoc => {							// merge each calendar item onto the schedule
		const eventList = firstRow<Event>(events, fire.addWhere(FIELD.Key, calendarDoc[FIELD.Type]));
		let offset = 0;															// start-time offset

		if (!calendarDoc.location)
			calendarDoc.location = locn[FIELD.Key];		// default Location
		if (!eventLocations.includes(calendarDoc.location))
			eventLocations.push(calendarDoc.location);// track the Locations at which an Event is running

		asArray(eventList.agenda).forEach(className => {
			const classDoc = firstRow<Class>(classes, fire.addWhere(FIELD.Key, className));
			const spanClass = firstRow<Span>(spans, [
				fire.addWhere(FIELD.Key, classDoc[FIELD.Key]),// is there a span keyed by the name of the Class?
				fire.addWhere(FIELD.Type, STORE.Event),
			])
			const span = firstRow<Span>(spans, [
				fire.addWhere(FIELD.Key, classDoc[FIELD.Type]),// is there a span keyed by the type ('full'/'half') of the Class?
				fire.addWhere(FIELD.Type, STORE.Event),
			])
			const duration = spanClass.duration ?? span.duration;
			const time: Partial<Schedule> = {
				[FIELD.Id]: classDoc[FIELD.Id],
				[FIELD.Type]: SCHEDULE.Event,
				[FIELD.Key]: className,
				day: calendarDoc.day,
				location: calendarDoc.location,
				start: getInstant(calendarDoc.start).add(offset, 'minutes').format(Instant.FORMAT.HHMI),
				instructor: calendarDoc.instructor,
				span: classDoc[FIELD.Type],
				image: firstRow<Icon>(icons, fire.addWhere(FIELD.Key, className)).image || icon[FIELD.Key],
			}

			offset += duration;												// update offset to next class start-time
			const timeIdx = times.findIndex(doc => doc[FIELD.Id] === time[FIELD.Id]);
			if (timeIdx === -1)
				times.push(time as Schedule);						// add the Event to the timetable
		})
	})

	// for each item on the schedule, poke in 'price' and 'icon',
	// override plan-price if entitled to bonus

	/** remove Bonus, if not entitled */
	if (!plans[0].bonus)
		source[COLLECTION.Client][STORE.Bonus] = source[COLLECTION.Client][STORE.Bonus]?.filter(bonus => bonus[FIELD.Key] === BONUS.Gift);

	source.client.schedule = times
		.map(time => {
			const classDoc = firstRow<Class>(classes, fire.addWhere(FIELD.Key, time[FIELD.Key]));
			const bonus = calcBonus(source, classDoc[FIELD.Key], date, elect);
			time.bonus = isEmpty(bonus) ? undefined : bonus;
			time.price = firstRow<Price>(prices, fire.addWhere(FIELD.Type, classDoc[FIELD.Type]));
			time.amount = isUndefined(time.bonus?.[FIELD.Id])	// no Bonus for this class
				? time.price.amount
				: nullToZero(time.bonus?.amount)								// a specific-amount, else $0

			time.count = attendToday.filter(row => row.timetable[FIELD.Key] == time[FIELD.Key]).length;

			if (!time[FIELD.Image])											// if no schedule-specific icon, use class icon, else default icon
				time[FIELD.Image] =
					firstRow<Icon>(icons, fire.addWhere(FIELD.Key, classDoc[FIELD.Key])).image ||
					firstRow<Icon>(icons, fire.addWhere(FIELD.Key, icon[FIELD.Key])).image

			if (!time.location)
				time.location = locn[FIELD.Key];					// ensure a default location exists
			return time;
		})

		.filter(time => !isUndefined(time.amount))		// remove Schedules that are not available on this Member's Plan

		/**
		 * Special Events take priority over scheduled Classes.  
		 * remove Classes at Location, if an Event is offered there
		 */
		.filter(row => row[FIELD.Type] === SCHEDULE.Event || !eventLocations.includes(row.location!))

	/** remove Locations that have no Schedules */
	source[COLLECTION.Client][STORE.Location] = source[COLLECTION.Client][STORE.Location]
		?.filter(locn => source[COLLECTION.Client][STORE.Schedule]?.distinct(time => time.location).includes(locn[FIELD.Key]))

	return { ...source }
}
