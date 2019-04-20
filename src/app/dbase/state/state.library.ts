import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { IFireClaims } from '@service/auth/auth.interface';
import { getMemberAge } from '@service/member/member.library';
import { asAt, firstRow, filterTable } from '@dbase/library/app.library';

import { IState, IAccountState, ITimetableState, IPlanState, SLICE, TStateSlice, IApplicationState, IAdminState, IBonusState } from '@dbase/state/state.define';
import { IDefault, IStoreMeta, TStoreBase, IClass, IPrice, IEvent, ISchedule, ISpan, IProfilePlan, IMeta } from '@dbase/data/data.schema';
import { STORE, FIELD, SLICES, SORTBY } from '@dbase/data/data.define';

import { asArray, deDup } from '@lib/array.library';
import { getPath, sortKeys, cloneObj, isEmpty } from '@lib/object.library';
import { isString, isArray, isFunction, isUndefined } from '@lib/type.library';
import { DATE_FMT, getDate, TDate } from '@lib/date.library';
import { addWhere } from '@dbase/fire/fire.library';

/**
 * Generic Slice Observable  
 *  w/ special logic to slice 'attend' store, as it uses non-standard indexing
 */
export const getCurrent = <T>(states: IState, store: string, filter: TWhere = [], date?: TDate, index?: string) => {
	const slice = getSlice(store);
	const state = states[slice] as Observable<IStoreMeta>;
	const sortBy = SORTBY[store];

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(state => asAt<T>(state[index || store], filter, date)),
		map(table => table && table.sort(sortKeys(...asArray(sortBy)))),
	)
}

/**
 * Get all documents by filter, do not exclude _expire
 */
export const getStore = <T>(states: IState, store: string, filter: TWhere = [], date?: TDate) => {
	const slice = getSlice(store);
	if (store === slice)													// top-level slice
		return getState<T>(states, store, filter, date);

	const state: Observable<TStateSlice<T>> = states[slice] as any;

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(obs => filterTable<T>(obs[store], filter)),
	)
}
export const getState = <T>(states: IState, store: string, filter: TWhere = [], date?: TDate) => {
	const state: Observable<TStateSlice<T>> = states[store] as any;

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	const res: T[] = []
	return state.pipe(
		map(obs => Object.keys(obs).map(list => res.concat(Object.values(obs[list]))).flat()),
		map(table => filterTable<T>(table, filter))
	)
}

export const getSlice = (store: string) => {    // determine the state-slice based on the <store> field
	const slices = Object.keys(SLICES)
		.filter(col => SLICES[col].includes(store));// find which slice holds the requested store

	if (isEmpty(SLICES))													// nothing in State yet, on first-time connect
		slices.push(SLICE.client);									// special: assume 'client' slice.
	if (!SORTBY[store])
		SORTBY[store] = ['sort', 'key'];						// special: assume sort order

	if (!slices.length)
		alert(`Unexpected store: ${store}`)

	return slices[0];
}

export const getDefault = (state: IApplicationState, type: string) => {
	const table = (state['application'][STORE.default])
		.filter(row => row[FIELD.type] === type);       // find the default value for the requested type
	return table.length && table[0][FIELD.key] || undefined;
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
	({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a document to other documents referenced a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * node:   	the name of the node (eg. 'member') under which we place the documents on the Observable Object  
 * store:   the parent documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, node: string | undefined, store: string, filter: TWhere = [], date?: TDate, callBack?: CallableFunction) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, cloneObj(filter)); // loop through filters
				const index = (store === STORE.attend) ? filters[0].value : store;	// TODO: dont rely on defined filter

				parent = data;                                        // stash the original parent data state

				return combineLatest(getCurrent<TStoreBase>(states, store, filters, date, index));
			}),

			map(res => {
				const nodes = node && node.split('.') || [];
				let joins: { [key: string]: TStoreBase[] } = nodes[0] && parent[nodes[0]] || {};

				res.forEach(table => {
					if (table.length) {
						table.forEach(row => {
							const type = (getSlice(store) === 'client')
								? row[FIELD.store]
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
						const sortBy = SORTBY[store];
						joins[table] = joins[table].sort(sortKeys(...asArray(sortBy)));
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

		cond.value = deDup(asArray(cond.value)
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
			}))

		if (cond.value.length === 1)
			cond.value = cond.value[0];                           // an array of only one value, return as string

		return cond;                                            // rebuild each filter
	})
}

/**
 * Use the Observable on open IPayment[] to determine current account-status (paid, pending, bank, adjusts, etc.).  
 * The IPayment array is reverse-sorted by 'stamp', meaning payment[0] is the 'active' value.  
 * paid		: is amount from active payment, if topUp
 * adjust : is amount from active payment, if debit  
 * bank		: is any unspent funds (brought forward from previous payment)  
 * pend 	: is amount from future payments (not yet 'active')  
 */
export const sumPayment = (source: IAccountState) => {
	if (source.account) {
		source.account.payment = asArray(source.account.payment);
		source.account.summary = source.account.payment
			.reduce((sum, payment, indx) => {
				if (indx === 0/** && payment[FIELD.effect] */) {		// only 1st Payment
					sum.bank += payment.bank || 0;

					// if (payment[FIELD.type] === 'debit') {
					// 	sum.adjust += payment.amount || 0;
					// 	sum.paid += payment.adjust || 0;
					// } else {
					sum.adjust += payment.adjust || 0;
					sum.paid += payment.amount || 0;
					// }

				} else
					sum.pend += (payment.amount || 0) + (payment.adjust || 0) + (payment.bank || 0);

				sum.credit = sum.bank + sum.paid + sum.adjust + sum.pend;
				sum.funds = sum.bank + sum.paid + sum.adjust;

				return sum;
			}, { paid: 0, bank: 0, adjust: 0, pend: 0, spend: 0, credit: 0, funds: 0 })

	}

	return { ...source };
}

/** Use the Observable on IAttend[] to add-up the cost of the Classes on the active IPayment */
export const sumAttend = (source: IAccountState) => {
	if (source.account && isArray(source.account.attend)) {
		source.account.summary = source.account.attend
			.reduce((sum, attend) => {
				sum.spend += attend.amount;
				sum.credit -= attend.amount;
				sum.funds -= attend.amount;
				return sum;
			}, source.account.summary);
	}

	return { ...source };
}

/** calc a 'day' field for a Calendar row */
export const calendarDay = (source: ITimetableState) => {
	if (source.client.calendar) {
		source.client.calendar = source.client.calendar
			.map(row => ({ ...row, day: getDate(row[FIELD.key]).dow }))
	}
	return { ...source };
}

/** Assemble a Plan-view */
export const buildPlan = (source: IPlanState) => {
	const roles = getPath<string[]>(source.auth, 'token.claims.claims.roles');
	const isAdmin = roles && roles.includes('admin');
	const myPlan = firstRow<IProfilePlan>(source.member.plan, addWhere(FIELD.type, 'plan'));
	const myTopUp = firstRow<IPrice>(source.client.price, addWhere(FIELD.type, 'topUp'));
	const myAge = getMemberAge(source.member.info);	// use birthDay from provider, if available

	source.client.plan = source.client.plan.map(plan => {   // array of available Plans
		const planPrice = firstRow<IPrice>(source.client.price, [
			addWhere(FIELD.key, plan[FIELD.key]),
			addWhere(FIELD.type, 'topUp'),
		])

		if (planPrice.amount < myTopUp.amount && !isAdmin)    // Special: dont allow downgrades in price
			plan[FIELD.disable] = true;

		if (plan[FIELD.key] === 'intro')											// Special: Intro is only available to new Members
			plan[FIELD.hidden] = (myPlan && !isAdmin) ? true : false;

		if (plan[FIELD.key] === 'pension') {									// Special: Pension is only available to senior Member
			const notAllow = myAge < 60 && !isAdmin;						// check member is younger than 60 and not Admin
			plan[FIELD.hidden] = notAllow;
			plan[FIELD.disable] = notAllow;
		}

		if (myPlan && myPlan.plan === plan[FIELD.key])	 			// disable their current Plan, so cannot re-select
			plan[FIELD.disable] = true;

		return plan
	});

	return { ...source };
}

/**
 * use the collected Schedule items to determine the Timetable to display.  
 * schedule type 'event' overrides 'class'; 'special' appends.  
 */
export const buildTimetable = (source: ITimetableState) => {
	const {
		schedule: times = [],												// the schedule for the requested date
		class: classes = [],    										// the classes offered on that date
		calendar = [],															// the calendar of special events on the date
		event: events = [],													// the event-description for the calendar type
		span: spans = [],														// the duration of classes / events
		alert: alerts = [],													// any alert notes for this date
	} = source.client;
	const {
		price: prices = [],
	} = source.client;														// the prices as per member's plan

	const icon = firstRow<IDefault>(source.application[STORE.default], addWhere(FIELD.type, 'icon'));
	const locn = firstRow<IDefault>(source.application[STORE.default], addWhere(FIELD.type, 'location'));
	const eventLocations: string[] = [];					// the locations at which a Special Event is running

	/**
	 * If we found any Calendar events, push them on the Timetable.  
	 * assume a Calendar's location overrides the usual Schedule at the location.
	 */
	calendar.forEach(calendarDoc => {							// merge each calendar item onto the schedule
		const eventList = firstRow<IEvent>(events, addWhere(FIELD.key, calendarDoc[FIELD.type]));
		let offset = 0;															// start-time offset

		if (!calendarDoc.location)
			calendarDoc.location = locn[FIELD.key];		// default Location
		if (!eventLocations.includes(calendarDoc.location))
			eventLocations.push(calendarDoc.location);// track the Locations at which an Event is running

		asArray(eventList.classes).forEach(className => {
			const classDoc = firstRow<IClass>(classes, addWhere(FIELD.key, className));
			const span = firstRow<ISpan>(spans, [
				addWhere(FIELD.key, classDoc[FIELD.type]),
				addWhere(FIELD.type, STORE.event),
			])

			const time: Partial<ISchedule> = {
				[FIELD.id]: classDoc[FIELD.id],
				[FIELD.type]: eventList[FIELD.store],
				[FIELD.key]: className,
				day: calendarDoc.day,
				location: calendarDoc.location,
				start: getDate(calendarDoc.start).add(offset, 'minutes').format(DATE_FMT.HHMI),
				instructor: calendarDoc.instructor,
				span: classDoc[FIELD.type],
				icon: classDoc.icon,
			}

			offset += span.duration;									// update offset to next class start-time
			times.push(time as ISchedule);						// add the Event to the timetable
		})
	})

	// for each item on the schedule, poke in 'price' and 'icon'
	// TODO: determine bonus-pricing
	source.client.schedule = times
		.map(time => {
			const classDoc = firstRow<IClass>(classes, addWhere(FIELD.key, time[FIELD.key]));
			const price = firstRow<IPrice>(prices, addWhere(FIELD.type, classDoc[FIELD.type]));

			if (classDoc[FIELD.type] && !isUndefined(price.amount)) {
				time.price = time.price || price.amount;	// add-on the member's price for each scheduled event
			}
			else time[FIELD.disable] = true;						// cannot determine the event

			if (!time[FIELD.icon])											// if no schedule-specific icon...
				time[FIELD.icon] = classDoc.icon || icon[FIELD.key];				//	use class icon, else default icon

			if (!time.location)
				time.location = locn[FIELD.key];					// ensure a default location exists

			return time;
		})

		/**
		 * Special Events take priority over Classes.  
		 * remove Classes at Location, if an Event is offered there
		 */
		.filter(row => row[FIELD.type] === 'event' || !eventLocations.includes(row.location!))

	return { ...source }
}

export const getDash = (source: IAdminState) => {
	source.admin.dashBoard = source.admin.register
		.map(register => ({
			register,
			account: source.admin.summary && source.admin.summary.find(acct => acct[FIELD.uid] === register[FIELD.uid]),
		}))

	return { ...source }
}

/** Calculate tracking against Bonus schemes */
export const calcBonus = (source: IBonusState) => {

	console.log('bonus: ', source);
	// console.log('schemes: ', schemes);
	// console.log('gifts: ', gifts);
	// console.log('trackGift: ', trackGift);
	// console.log('trackWeek: ', now.format(DATE_FMT.yearWeek), trackWeek);
	// console.log('trackMonth: ', now.format(DATE_FMT.yearMonth), trackMonth);
	return { ...source }
}