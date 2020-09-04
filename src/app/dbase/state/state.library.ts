import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { addWhere } from '@dbase/fire/fire.library';
import { IFireClaims } from '@service/auth/auth.interface';
import { calcBonus } from '@service/member/attend.library';
import { getMemberAge } from '@service/member/member.library';
import { SLICES, SORTBY } from '@dbase/state/config.define';

import { IState, AccountState, TimetableState, PlanState, SLICE, TStateSlice, ApplicationState, ProviderState } from '@dbase/state/state.define';
import { Default, StoreMeta, Class, Price, Event, Schedule, Span, ProfilePlan, TStoreBase, Icon, Calendar, ISummary } from '@dbase/data/data.schema';
import { asAt, firstRow, filterTable } from '@library/app.library';
import { COLLECTION, STORE, FIELD, BONUS, PRICE, PLAN, SCHEDULE, Auth } from '@dbase/data/data.define';

import { asArray } from '@library/array.library';
import { getDate, TInstant, Instant } from '@library/instant.library';
import { getPath } from '@library/object.library';
import { isString, isArray, isFunction, isUndefined, isEmpty, nullToZero } from '@library/type.library';

/**
 * Generic Slice Observable  
 *  w/ special logic to slice 'attend' store, as it uses non-standard segmenting
 */
export const getCurrent = <T>(states: IState, store: STORE, filter: TWhere = [], date?: TInstant, segment?: string) => {
	const slice = getSlice(store);
	const state = states[slice] as Observable<StoreMeta>;

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(state => asAt<T>(state[segment || store], filter, date)),
		map(table => table.sortBy(...asArray(SORTBY[store])))
	)
}

/**
 * Get all documents by filter,  
 * do not exclude _expire unless <date> specified
 */
export const getStore = <T>(states: IState, store: STORE, filter: TWhere = [], date?: TInstant) => {
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
		map(table => table.sortBy(...asArray(SORTBY[store]))),
	)
}
export const getState = <T>(states: IState, store: STORE, filter: TWhere = [], date?: TInstant) => {
	const state: Observable<TStateSlice<T>> = states[store] as any;

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	const res: T[] = []
	return state.pipe(
		map(obs => Object.keys(obs).map(list => res.concat(Object.values(obs[list]))).flat()),
		map(table => isUndefined(date) ? filterTable<T>(table, filter) : asAt<T>(table, filter, date)),
		map(table => table.sortBy(...asArray(SORTBY[store]))),
	)
}

export const getSlice = (store: STORE) => {			// determine the state-slice based on the <store> field
	const slices = Object.keys(SLICES)
		.filter(key => SLICES[key as COLLECTION]!.includes(store));// find which slice holds the requested store

	if (isEmpty<object>(SLICES))									// nothing in State yet, on first-time connect
		slices.push(SLICE.client);									// special: assume 'client' slice.
	if (!SORTBY[store])
		SORTBY[store] = [FIELD.sort, FIELD.key];		// special: assume sort order

	if (!slices.length)
		alert(`Unexpected store: ${store}`)

	return slices[0] as COLLECTION;
}

/** find the default value for the requested type */
export const getDefault = (state: ApplicationState, type: string) => {
	const table = (state.application[STORE.default])
		.filter(row => row[FIELD.type] === type);

	return table.length && table[0][FIELD.key] || undefined;
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
	({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a document to other documents referenced by a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * node:   	the name of the node (eg. 'member') under which we place the documents on the Observable Object  
 * store:   the parent documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, node: string | undefined, store: STORE, filter: TWhere = [], date?: TInstant, callBack?: CallableFunction) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, filter);						// loop through filters
				parent = data;                                        // stash the original parent data state

				return combineLatest(store === STORE.attend
					? getStore<TStoreBase>(states, store, filters, date)
					: getCurrent<TStoreBase>(states, store, filters, date)
				);
			}),

			map(res => {
				if (store === STORE.calendar && !isUndefined(date)) {	// special logic to filter Calendar
					const now = getDate(date).ts;												// because it does not generally track _effect/_expire
					res[0] = (res[0] as Calendar[])
						.filter(row => now < (row[FIELD.expire] || getDate(row[FIELD.key]).endOf('day').ts))
						.filter(row => now >= (row[FIELD.effect] || getDate(row[FIELD.key]).ts))
				}

				const nodes = node && node.split('.') || [];					// specific branch on node
				let joins: Record<string, TStoreBase[]> = nodes[0] && parent[nodes[0]] || {};

				res.forEach(table => {
					if (table.length) {
						table.forEach(row => {
							const type = (getSlice(store) === COLLECTION.client)
								? (nodes[1] || row[FIELD.store])
								: (nodes[1] || row[FIELD.type] || row[FIELD.store])

							joins[type] = joins[type] || [];
							joins[type] = joins[type].filter(item => item[FIELD.id] !== row[FIELD.id]);
							joins[type].push(row);
						})
					} else {
						const type = nodes[1] || store;
						joins[type] = joins[type] || [];									// if there are no documents that match the criteria, return empty array
					}
				})

				Object.keys(joins).map(table => {                     // apply any provided sortBy criteria
					if (isArray(joins[table]) && joins[table].length) {
						const store = joins[table][0][FIELD.store];
						joins[table] = joins[table].sortBy(...asArray(SORTBY[store]));
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
const decodeFilter = (parent: any, filter: TWhere = []) => {
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
 * adjust : is amount from active payment, if debit  
 * bank		: is any unspent funds (brought forward from previous payment)  
 * pend 	: is amount from unapproved payments (not yet 'active')    
 * funds	: is amount remaining on active payment  
 * credit	: is amount remaining overall (i.e. including <pend>)
 */
export const sumPayment = (source: AccountState) => {
	if (source.account) {
		const sum: ISummary = { paid: 0, bank: 0, adjust: 0, pend: 0, spend: 0, credit: 0, funds: 0 };

		source.account.payment = asArray(source.account.payment);
		source.account.summary = source.account.payment
			.reduce((sum, payment, indx) => {
				if (indx === 0) {																		// only 1st Payment
					sum.bank += nullToZero(payment.bank)
					sum.adjust += nullToZero(payment.adjust);
					sum.paid += nullToZero(payment.amount);
				} else
					sum.pend += nullToZero(payment.amount) + nullToZero(payment.adjust) + nullToZero(payment.bank);

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
			.map(row => ({ ...row, day: getDate(row[FIELD.key]).dow }))
	}
	return { ...source }
}

const lookupIcon = (source: any, key: string) => {
	const dflt = firstRow<Default>(source.application[STORE.default], addWhere(FIELD.type, STORE.icon))[FIELD.key];
	return firstRow<Icon>(source.client.icon, addWhere(FIELD.key, [key, dflt])).image
};

/** Assemble a Provider-view */
export const buildProvider = (source: ProviderState) => {
	source.client.provider = source.client.provider.map(provider => {
		if (!provider.image)
			provider.image = lookupIcon(source, provider[FIELD.key]);

		return provider;
	})

	return { ...source }
}

/** Assemble a Plan-view */
export const buildPlan = (source: PlanState) => {
	const roles = getPath<string[]>(source.auth, 'token.claims.claims.roles');
	const isAdmin = roles && roles.includes(Auth.ROLE.admin);
	const myPlan = firstRow<ProfilePlan>(source.member.plan, addWhere(FIELD.type, STORE.plan));
	const myTopUp = firstRow<Price>(source.client.price, addWhere(FIELD.type, PRICE.topUp));
	const myAge = getMemberAge(source.member.info);					// use birthDay from provider, if available

	source.client.plan = source.client.plan.map(plan => {   // array of available Plans
		const planPrice = firstRow<Price>(source.client.price, [
			addWhere(FIELD.key, plan[FIELD.key]),
			addWhere(FIELD.type, PRICE.topUp),
		])

		if (planPrice.amount < myTopUp.amount && !isAdmin)    // Special: dont allow downgrades in price
			plan[FIELD.disable] = true;

		if (plan[FIELD.key] === PLAN.intro)										// Special: Intro is only available to new Members
			plan[FIELD.hidden] = (myPlan && !isAdmin) ? true : false;

		if (plan[FIELD.key] === PLAN.senior) {								// Special: Senior is only available to >=60 Member
			const notAllow = myAge < 60 && !isAdmin;						// check member is younger than 60 and not Admin
			plan[FIELD.hidden] = notAllow;
			plan[FIELD.disable] = notAllow;
		}

		if (!plan[FIELD.image])
			plan[FIELD.image] = lookupIcon(source, plan[FIELD.key]);

		if (myPlan && myPlan.plan === plan[FIELD.key])	 			// disable their current Plan, so cannot re-select
			plan[FIELD.disable] = true;

		return plan
	});

	return { ...source }
}

/**
 * use the collected Schedule items to determine the Timetable to display.  
 * schedule type 'event' overrides 'class'; 'special' appends.  
 */
export const buildTimetable = (source: TimetableState, date?: TInstant, elect?: BONUS) => {
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
	const attendToday = source[COLLECTION.attend].attendToday;
	const icon = firstRow<Default>(source.application[STORE.default], addWhere(FIELD.type, STORE.icon));
	const locn = firstRow<Default>(source.application[STORE.default], addWhere(FIELD.type, STORE.location));
	const eventLocations: string[] = [];					// the locations at which a Special Event is running

	/**
	 * If we found any Calendar events, push them on the Timetable.  
	 * assume a Calendar's location overrides the usual Schedule at the location.
	 */
	calendar.forEach(calendarDoc => {							// merge each calendar item onto the schedule
		const eventList = firstRow<Event>(events, addWhere(FIELD.key, calendarDoc[FIELD.type]));
		let offset = 0;															// start-time offset

		if (!calendarDoc.location)
			calendarDoc.location = locn[FIELD.key];		// default Location
		if (!eventLocations.includes(calendarDoc.location))
			eventLocations.push(calendarDoc.location);// track the Locations at which an Event is running

		asArray(eventList.agenda).forEach(className => {
			const classDoc = firstRow<Class>(classes, addWhere(FIELD.key, className));
			const spanClass = firstRow<Span>(spans, [
				addWhere(FIELD.key, classDoc[FIELD.key]),// is there a span keyed by the name of the Class?
				addWhere(FIELD.type, STORE.event),
			])
			const span = firstRow<Span>(spans, [
				addWhere(FIELD.key, classDoc[FIELD.type]),// is there a span keyed by the type ('full'/'half') of the Class?
				addWhere(FIELD.type, STORE.event),
			])
			const duration = spanClass.duration ?? span.duration;
			const time: Partial<Schedule> = {
				[FIELD.id]: classDoc[FIELD.id],
				[FIELD.type]: SCHEDULE.event,
				[FIELD.key]: className,
				day: calendarDoc.day,
				location: calendarDoc.location,
				start: getDate(calendarDoc.start).add(offset, 'minutes').format(Instant.FORMAT.HHMI),
				instructor: calendarDoc.instructor,
				span: classDoc[FIELD.type],
				image: firstRow<Icon>(icons, addWhere(FIELD.key, className)).image || icon[FIELD.key],
			}

			offset += duration;												// update offset to next class start-time
			times.push(time as Schedule);						// add the Event to the timetable
		})
	})

	// for each item on the schedule, poke in 'price' and 'icon',
	// override plan-price if entitled to bonus

	/** remove Bonus, if not entitled */
	if (!plans[0].bonus)
		source[COLLECTION.client][STORE.bonus] = source[COLLECTION.client][STORE.bonus]?.filter(bonus => bonus[FIELD.key] === BONUS.gift);

	source.client.schedule = times
		.map(time => {
			const classDoc = firstRow<Class>(classes, addWhere(FIELD.key, time[FIELD.key]));
			const bonus = calcBonus(source, classDoc[FIELD.key], date, elect);
			time.bonus = isEmpty(bonus) ? undefined : bonus;
			time.price = firstRow<Price>(prices, addWhere(FIELD.type, classDoc[FIELD.type]));
			time.amount = isUndefined(time.bonus?.[FIELD.id])	// no Bonus for this class
				? time.price.amount
				: nullToZero(time.bonus?.amount)								// a specific-amount, else $0

			time.count = attendToday.filter(row => row.timetable[FIELD.key] == time[FIELD.key]).length;

			if (!time[FIELD.image])											// if no schedule-specific icon, use class icon, else default icon
				time[FIELD.image] =
					firstRow<Icon>(icons, addWhere(FIELD.key, classDoc[FIELD.key])).image ||
					firstRow<Icon>(icons, addWhere(FIELD.key, icon[FIELD.key])).image

			if (!time.location)
				time.location = locn[FIELD.key];					// ensure a default location exists
			return time;
		})

		.filter(time => !isUndefined(time.amount))		// remove Schedules that are not available on this Member's Plan

		/**
		 * Special Events take priority over scheduled Classes.  
		 * remove Classes at Location, if an Event is offered there
		 */
		.filter(row => row[FIELD.type] === SCHEDULE.event || !eventLocations.includes(row.location!))

	/** remove Locations that have no Schedules */
	source[COLLECTION.client][STORE.location] = source[COLLECTION.client][STORE.location]
		?.filter(locn => source[COLLECTION.client][STORE.schedule]?.distinct(time => time.location).includes(locn[FIELD.key]))

	return { ...source }
}
