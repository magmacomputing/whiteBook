import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { IFireClaims } from '@service/auth/auth.interface';
import { getMemberAge } from '@service/member/member.library';
import { asAt, firstRow } from '@dbase/library/app.library';

import { IState, IAccountState, ITimetableState, IPlanState } from '@dbase/state/state.define';
import { IDefault, IStoreMeta, TStoreBase, IClass, IPrice, IEvent, ISchedule, ISpan, IProfilePlan } from '@dbase/data/data.schema';
import { SORTBY, STORE, FIELD } from '@dbase/data/data.define';
import { getSlice } from '@dbase/data/data.library';

import { asArray, deDup } from '@lib/array.library';
import { getPath, sortKeys, cloneObj } from '@lib/object.library';
import { isString, isArray, isFunction, isUndefined } from '@lib/type.library';
import { fmtDate, DATE_KEY, parseDate } from '@lib/date.library';

/**
 * Generic Slice Observable  
 * Special logic to slice 'attend' store, as it uses non-standard indexing
 */
export const getStore = <T extends IStoreMeta>(states: IState, store: string, filter: TWhere = [], date?: number, index?: string) => {
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
export const joinDoc = (states: IState, node: string | undefined, store: string, filter: TWhere = [], date?: number, callBack?: Function) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, cloneObj(filter)); // loop through filters
				const index = (store === STORE.attend) ? filters[0].value : store;	// TODO: dont rely on defined filter

				parent = data;                                        // stash the original parent data state

				return combineLatest(getStore<TStoreBase>(states, store, filters, date, index));
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
const decodeFilter = (parent: any, filter: TWhere) => {
	return asArray(filter).map(cond => {                      // loop through each filter

		cond.value = deDup(asArray(cond.value)
			.flatMap(value => {    																		// loop through filter's <value>
				const isPath = isString(value) && value.substring(0, 2) === '{{';
				let lookup = value;

				if (isPath) {                                       // check if is it a fieldPath reference on the parent
					const child = value.replace('{{', '').replace('}}', '').replace(' ', '');
					const dflt = child.split('.').reverse()[0];       // get the last component of the fieldPath
					const table = (parent['default'][STORE.default] as IDefault[])
						.filter(row => row[FIELD.type] === dflt);       // find the default value for the requested fieldPath
					const defaultValue = table.length && table[0][FIELD.key] || undefined;

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
 * Use the Observable on open IPayment[] to determine current account-status (paid, pending, bank, etc.).  
 * The IPayment array is pre-sorted by 'stamp', meaning payment[0] is active.  
 * paid		: is amount from active payment  
 * bank		: is any unspent credit on active payment (brought forward from previous payment)  
 * pend 	: is amount from future payments  
 */
export const sumPayment = (source: IAccountState) => {
	if (source.account && isArray(source.account.payment)) {
		source.account.summary = source.account.payment
			.reduce((sum, payment, indx) => {
				if (indx === 0 && payment[FIELD.effect]) {
					sum.bank += payment.bank || 0;
					sum.paid += payment.amount || 0;
				}
				else sum.pend += payment.amount

				return sum;
			}, { paid: 0, bank: 0, pend: 0, spend: 0 })
	}

	return source;
}

/** Use the Observable on IAttend[] to add-up the cost of the Classes on the active IPayment */
export const sumAttend = (source: IAccountState) => {
	if (source.account && isArray(source.account.attend)) {
		source.account.summary.spend = source.account.attend
			.reduce((spend, attend) => spend + attend.amount, 0);
	}

	return source;
}

/** calc a 'day' field for a Calendar row */
export const calendarDay = (source: ITimetableState) => {
	if (source.client.calendar) {
		source.client.calendar = source.client.calendar
			.map(row => Object.assign({ day: fmtDate(row[FIELD.key], DATE_KEY.weekDay), row }))
	}

	return { ...source };
}

/** Assemble a Plan-view */
export const buildPlan = (source: IPlanState) => {
	const roles = getPath<string[]>(source.auth, 'token.claims.roles');
	const isAdmin = roles && roles.includes('admin');
	const myPlan = firstRow<IProfilePlan>(source.member.plan, { fieldPath: FIELD.type, value: 'plan' });
	const myTopUp = firstRow<IPrice>(source.member.price, { fieldPath: FIELD.type, value: 'topUp' });
	const myAge = getMemberAge(source.member.info);					// use birthDay from provider, if available

	source.client.plan = source.client.plan.map(plan => {   // array of available Plans
		const planPrice = firstRow<IPrice>(source.client.price, [
			{ fieldPath: FIELD.key, value: plan[FIELD.key] },
			{ fieldPath: FIELD.type, value: 'topUp' },
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
 * schedule type 'event' overrides 'class', 'special' appends.  
 */
export const buildTimetable = (source: ITimetableState) => {
	const {
		schedule: times = [],												// the schedule for the requested date
		class: classes = [],    										// the classes offered on that date
		calendar = [],															// the calendar of special events on the date
		event: events = [],													// the event-description for the calendar type
		span: spans = [],														// the duration of classes / events
	} = source.client;
	const {
		price: prices = [],
	} = source.member;														// the prices as per member's plan

	const icon = firstRow<IDefault>(source.default[STORE.default], { fieldPath: FIELD.type, value: 'icon' });
	const locn = firstRow<IDefault>(source.default[STORE.default], { fieldPath: FIELD.type, value: 'location' });
	const eventLocations: string[] = [];					// the locations at which a Special Event is running

	/**
	 * If we found any Calendar events, push them on the Timetable.  
	 * assume a Calendar's location overrides an usual Schedule at the location.
	 */
	calendar.forEach(calendarDoc => {							// merge each calendar item onto the schedule
		const eventList = firstRow<IEvent>(events, { fieldPath: FIELD.key, value: calendarDoc[FIELD.type] });
		let offset = 0;															// start-time offset

		if (!calendarDoc.location)
			calendarDoc.location = locn[FIELD.key];		// default Location
		if (!eventLocations.includes(calendarDoc.location))
			eventLocations.push(calendarDoc.location);// track the Locations at which an Event is running

		asArray(eventList.classes).forEach(className => {
			const classDoc = firstRow<IClass>(classes, { fieldPath: FIELD.key, value: className });
			const span = firstRow<ISpan>(spans, [
				{ fieldPath: FIELD.key, value: classDoc[FIELD.type] },
				{ fieldPath: FIELD.type, value: STORE.event },
			])

			const time: Partial<ISchedule> = {
				[FIELD.id]: classDoc[FIELD.id],
				[FIELD.type]: eventList[FIELD.store],
				[FIELD.key]: className,
				day: calendarDoc.day,
				location: calendarDoc.location,
				start: parseDate(calendarDoc.start).add(offset, 'minutes').format(DATE_KEY.HHmm),
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
			const classDoc = firstRow<IClass>(classes, { fieldPath: FIELD.key, value: time[FIELD.key] });
			const price = firstRow<IPrice>(prices, { fieldPath: FIELD.type, value: classDoc[FIELD.type] });

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

	return { ...source };
}