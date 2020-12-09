import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, take, startWith, distinctUntilChanged } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { AuthSlice } from '@dbase/state/auth.action';
import type { TStateSlice, ApplicationState, AdminState, ClientState, ProviderState, ForumState } from '@dbase/state/state.define';
import type { MemberState, PlanState, TimetableState, IState, OState, AccountState, UserState } from '@dbase/state/state.define';
import { joinDoc, sumPayment, sumAttend, calendarDay, buildTimetable, buildPlan, getDefault, getCurrent, getStore, getState, buildProvider } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD, BONUS, COLLECTION, STATUS } from '@dbase/data.define';
import type { FireDocument, Register, Connect, Account, Comment, React, Sheet, TStoreConfig, TStoreClient, ClientCollection } from '@dbase/data.schema';

import { FireService } from '@dbase/fire/fire.service';
import { fire } from '@dbase/fire/fire.library';

import { Instant, getInstant } from '@library/instant.library';
import { cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between related Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
	@Select() auth$!: Observable<AuthSlice>;
	@Select() client$!: OState;
	@Select() member$!: OState;
	@Select() attend$!: OState;
	@Select() admin$!: OState;
	@Select() local$!: Observable<TStateSlice<FireDocument>>;
	private forum$: OState = of({ forum: [] });

	#dbg = dbg(this);
	#states: IState;

	constructor(private fire: FireService) {
		this.#states = {                   // a Lookup map for Slice-to-State
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
			'local': this.local$,
			'forum': this.forum$,
		}
	}

	/** Fetch the current, useable values for a supplied store */
	getCurrent<T>(store: STORE, where?: fire.Query["where"]) {
		const filters = asArray(where);
		filters.push(fire.addWhere(FIELD.Expire, 0));
		filters.push(fire.addWhere(FIELD.Hidden, false));

		return getCurrent<T>(this.#states, store, filters);
	}

	getStore<T>(store: STORE, where?: fire.Query["where"], date?: Instant.TYPE) {
		return getStore<T>(this.#states, store, where, date);
	}

	getState<T>(store: STORE, where?: fire.Query["where"]) {
		return getState<T>(this.#states, store, where);
	}

	getSingle<T>(store: STORE, filter: fire.Query["where"]) {
		return this.asPromise(this.getCurrent<T>(store, filter))
			.then(table => table[0]);				// only the first document
	}

	/** lookup the Default store for a given 'type' */
	getDefault(state: ApplicationState, type: string) {
		return getDefault(state, type);
	}

	asPromise<T>(obs: Observable<T>) {
		return obs
			.pipe(take(1))									// only the first snapshot
			.toPromise();
	}

	/**
	* Assemble a UserState Object describing an authenticated User
	*/
	getAuthData(): Observable<UserState> {
		return this.auth$.pipe(
			map(auth => ({ auth: cloneObj(auth) })),
		)
	}

	/**
	 * Cast the Ngxs Client$ store
	 */
	getClientData() {
		return this.client$ as Observable<ClientState>;
	}

	/**
	 * Assemble an AdminState Object describing stores only available to Members with 'admin' role
	 * dash.register	-> has an array of the current state of /admin/register
	 * dash.account		-> has an array of the current value of /admin/account
	 * dash.connect 	-> has an array of the current connections in /admin/connect
	 * dash.sheet			-> has an array of the current state of /admin/sheet
	 */
	getAdminData(): Observable<AdminState> {
		return this.admin$.pipe(
			map(source => ({
				[STORE.Register]: source[STORE.Register] as Register[],
				[STATUS.Account]: source[STATUS.Account] as Account[],
				[STATUS.Connect]: source[STATUS.Connect] as Connect[],
				[STORE.Sheet]: source[STORE.Sheet] as Sheet[],
				dash: [...(source[STORE.Register] || [])]
					.orderBy('user.customClaims.alias')
					.map(reg => ({
						[STORE.Register]: reg as Register,
						[STATUS.Account]: (source[STATUS.Account] || [])
							.find(account => account[FIELD.Uid] === reg[FIELD.Uid]) as Account,
						[STATUS.Connect]: (source[STATUS.Connect] || [])
							.find(connect => connect[FIELD.Uid] === reg[FIELD.Uid]) as Connect,
						[STORE.Sheet]: (source[STORE.Sheet] || [])
							.find(sheet => sheet[FIELD.Uid] === reg[FIELD.Uid]) as Sheet
					}))
			}))
		)
	}

	/**
	 * Extend AuthState with an Object describing a Member returned as MemberState, where:  
	 * application._default -> has the current defaults to be used where join-fields are undefined  
	 * member.plan  -> has the asAt ProfilePlan for the user.uid  
	 * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
	 * member.gift	-> has an array of Member gifts  
	 * client.price -> has an array of Price that match the Member's plan-type  
	 * client.plan  -> has array of the asAt Plan description
	 * 
	 * @param date:	number	An optional as-at date to determine rows in an effective date-range
	 */
	getMemberData(date?: Instant.TYPE): Observable<MemberState> {
		const filterProfile = [
			fire.addWhere(FIELD.Type, ['plan', 'info', 'gift', 'account']),   	// where the <type> is either 'plan', 'info', 'gift' or 'account'
			fire.addWhere(FIELD.Uid, '{{auth.current.uid}}'),  								// and the <uid> is current active User
		]
		const filterPlan = fire.addWhere(FIELD.Key, '{{member.plan[0].plan}}');
		const filterMessage = fire.addWhere(FIELD.Type, 'alert');

		return this.getAuthData().pipe(
			joinDoc(this.#states, 'application', STORE.Default, undefined, date),
			joinDoc(this.#states, 'member', STORE.Profile, filterProfile, date),
			joinDoc(this.#states, 'member.message', STORE.Message, filterMessage, date),
			joinDoc(this.#states, 'client', STORE.Price, filterPlan, date),
			joinDoc(this.#states, 'client', STORE.Plan, filterPlan, date),
		)
	}

	/**
	 * Add current Plan[] and Price[] to the Member Profile Observable  
	 * client.plan  -> has an array of asAt Plan documents  
	 * client.price -> has an array of asAt Price documents
	 */
	getPlanData(date?: Instant.TYPE): Observable<PlanState> {
		const filterIcon = fire.addWhere(FIELD.Type, [STORE.Plan, STORE.Default]);

		return this.getMemberData(date).pipe(
			joinDoc(this.#states, 'client', STORE.Plan, undefined, date),
			joinDoc(this.#states, 'client', STORE.Price, undefined, date),
			joinDoc(this.#states, 'client', STORE.Icon, filterIcon, date),
			map(table => buildPlan(table)),
		)
	}

	/**
	 * A list of Sign-in Providers
	 * client.provider	-> has an array of Provider documents
	 * client.icon			-> has an array of Provider icons
	 */
	getProviderData(date?: Instant.TYPE): Observable<ProviderState> {
		const filterProvider = fire.addWhere(FIELD.Expire, 0);
		const filterIcon = fire.addWhere(FIELD.Type, [STORE.Provider, STORE.Default]);

		return this.getMemberData(date).pipe(
			joinDoc(this.#states, 'client', STORE.Provider, filterProvider, date),
			joinDoc(this.#states, 'client', STORE.Icon, filterIcon, date),
			map(table => buildProvider(table)),
		)
	}

	/**
	 * Add Account details to the Member Profile Observable  
	 * account.payment-> has an array of open (not asAt) details about the Member's account payments  
	 * account.attend	-> has an array of attendances against the <active> payment  
	 * account.summary-> has an object summarising the Member's Account value as { paid: $, bank: $, adjust: $, spend: $, credit: $, funds: $ }
	 */
	getAccountData(date?: Instant.TYPE): Observable<AccountState> {
		const filterPayment = [
			fire.addWhere(FIELD.Store, STORE.Payment),
			fire.addWhere(FIELD.Uid, '{{auth.current.uid}}'),
		];
		const filterAttend = [
			fire.addWhere(`payment.${FIELD.Id}`, `{{account.payment[0].${FIELD.Id}}}`),
			fire.addWhere(FIELD.Uid, '{{auth.current.uid}}'),
		];

		return this.getMemberData(date).pipe(
			joinDoc(this.#states, 'account.payment', STORE.Payment, filterPayment, undefined, sumPayment),
			joinDoc(this.#states, 'account.attend', STORE.Attend, filterAttend, undefined, sumAttend),
		)
	}

	/**
	 * Observe Forum data direct from FireStore (because it is not persisted to local Store)
	 * forum.comment	-> has an array of Comments about this date's schedule
	 * forum.react		-> has an array of Reacts about this date's schedule
	 */
	getForumData(date?: Instant.TYPE): Observable<ForumState> {
		const query: fire.Query = {
			where: fire.addWhere('track.date', getInstant(date).format(Instant.FORMAT.yearMonthDay)),
			orderBy: fire.addOrder(FIELD.Stamp),
		}

		return this.fire.listen<React | Comment>(COLLECTION.Forum, query).pipe(
			startWith([] as (React | Comment)[]),													// dont make subcriber wait for 1st emit
			distinctUntilChanged((curr, prev) => JSON.stringify(curr) === JSON.stringify(prev)),
			map(source => ({
				forum: {
					[STORE.React]: source.filter(row => row[FIELD.Store] === STORE.React) as React[],
					[STORE.Comment]: source.filter(row => row[FIELD.Store] === STORE.Comment) as Comment[],
				}
			})),
		)
	}

	/**
	 * Assemble an Object describing the Timetable for a specified date, where keys are:  
	 * schedule   -> has an array of Schedule info for the weekday of the date  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
	 * diary			-> has the future Calendar events
	 * event			-> has the Events that are indicated on that calendar
	 * class      -> has the Classes that are available on that schedule or event  
	 * location   -> has the Locations that are indicated on that schedule or calendar
	 * instructor -> has the Instructors that are indicated on that schedule or calendar
	 * span				-> has the Class Duration definitions ('full' or 'half')
	 * forum			-> has an array of Member comments about the Classes available on that schedule or event
	 * alert			-> has an array of Alert notes to display on the Attend component
	 * bonus			-> has an array of active Bonus schemes
	 * gift				-> has an array of active Gifts available to a Member on the date
	 * forum			-> has an array of Forum data for the date
	 */
	getScheduleData(date?: Instant.TYPE, elect?: BONUS): Observable<TimetableState> {
		const now = getInstant(date);
		const isMine = fire.addWhere(FIELD.Uid, `{{auth.current.uid}}`);

		const filterSchedule = fire.addWhere('day', [Instant.WEEKDAY.All, now.dow], 'in');
		const filterCalendar = fire.addWhere(FIELD.Key, now.format(Instant.FORMAT.yearMonthDay), '>');
		const filterEvent = fire.addWhere(FIELD.Key, `{{client.calendar.${FIELD.Type}}}`);
		const filterTypeClass = fire.addWhere(FIELD.Key, `{{client.schedule.${FIELD.Key}}}`);
		const filterTypeEvent = fire.addWhere(FIELD.Key, `{{client.event.agenda}}`);
		const filterLocation = fire.addWhere(FIELD.Key, ['{{client.schedule.location}}', '{{client.calendar.location}}']);
		const filterInstructor = fire.addWhere(FIELD.Key, ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}']);
		const filterSpan = fire.addWhere(FIELD.Key, [`{{client.class.${FIELD.Type}}}`, `{{client.class.${FIELD.Key}}}`]);
		const filterIcon = fire.addWhere(FIELD.Type, [STORE.Class, STORE.Default]);
		const attendGift = [isMine, fire.addWhere(`bonus.${FIELD.Id}`, `{{member.gift[*].${FIELD.Id}}}`)];
		const attendWeek = [isMine, fire.addWhere('track.week', now.format(Instant.FORMAT.yearWeek))];
		const attendMonth = [isMine, fire.addWhere('track.month', now.format(Instant.FORMAT.yearMonth))];
		const attendToday = [isMine, fire.addWhere(`track.${FIELD.Date}`, now.format(Instant.FORMAT.yearMonthDay))];
		const filterAlert = [
			fire.addWhere(FIELD.Type, STORE.Schedule),
			fire.addWhere('location', ['{{client.schedule.location}}', '{{client.calendar.location}}']),
		]

		return combineLatest([this.getClientData(), this.getForumData(date), this.getMemberData(date)]).pipe(
			map(([client, forum, member]) => ({ ...client, ...forum, ...member })),
			joinDoc(this.#states, 'application', STORE.Default, fire.addWhere(FIELD.Type, STORE.Icon)),
			joinDoc(this.#states, 'client', STORE.Schedule, filterSchedule, date),								// whats on this weekday (or every weekday)
			joinDoc(this.#states, 'client', STORE.Calendar, undefined, date, calendarDay),				// get calendar for this date
			joinDoc(this.#states, 'client.diary', STORE.Calendar, filterCalendar),								// get future events
			joinDoc(this.#states, 'client', STORE.Event, filterEvent, date),											// get event for this calendar-date
			joinDoc(this.#states, 'client', STORE.Class, filterTypeClass, date),									// get classes for this weekday
			joinDoc(this.#states, 'client', STORE.Class, filterTypeEvent, date),									// get agenda for this calendar-date
			joinDoc(this.#states, 'client', STORE.Icon, filterIcon, date),												// get the Class icons
			joinDoc(this.#states, 'client', STORE.Location, filterLocation, date),								// get location for this timetable
			joinDoc(this.#states, 'client', STORE.Instructor, filterInstructor, date),						// get instructor for this timetable
			joinDoc(this.#states, 'client', STORE.Span, filterSpan, date),												// get class durations
			joinDoc(this.#states, 'client', STORE.Alert, filterAlert, date),											// get any Alert message for this date
			joinDoc(this.#states, 'client', STORE.Bonus, undefined, date),												// get any active Bonus
			joinDoc(this.#states, 'member', STORE.Gift, isMine, date),														// get any active Gifts
			joinDoc(this.#states, 'attend.attendGift', STORE.Attend, attendGift),								// get any Attends against active Gifts
			joinDoc(this.#states, 'attend.attendWeek', STORE.Attend, attendWeek),								// get any Attends for this week
			joinDoc(this.#states, 'attend.attendMonth', STORE.Attend, attendMonth),							// get any Attends for this month
			joinDoc(this.#states, 'attend.attendToday', STORE.Attend, attendToday),							// get any Attends for this day
			map(table => buildTimetable(table, date, elect)),																		// assemble the Timetable
		) as Observable<TimetableState>																												// declare Type (to override pipe()'s artificial limit of 'nine' declarations)
	}

	/**
	 * Assemble a standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 */
	getTimetableData(date?: Instant.TYPE): Observable<TimetableState> {
		const now = getInstant(date);
		const filterClass = fire.addWhere(FIELD.Key, `{{client.schedule.${FIELD.Key}}}`);
		const filterLocation = fire.addWhere(FIELD.Key, '{{client.schedule.location}}');
		const filterCalendar = [
			fire.addWhere(FIELD.Key, now.startOf('week').format(Instant.FORMAT.yearMonthDay), '>='),
			fire.addWhere(FIELD.Key, now.endOf('week').format(Instant.FORMAT.yearMonthDay), '<='),
		]
		const filterEvent = fire.addWhere(FIELD.Key, `{{client.calendar.${FIELD.Type}}}`);

		return this.getClientData().pipe(																						// start with an empty Object
			joinDoc(this.#states, 'application', STORE.Default, undefined, date),
			joinDoc(this.#states, 'client', STORE.Schedule, undefined, date),
			joinDoc(this.#states, 'client', STORE.Class, filterClass, date),
			joinDoc(this.#states, 'client', STORE.Location, filterLocation, date),
			joinDoc(this.#states, 'client', STORE.Calendar, filterCalendar, date, calendarDay),
			joinDoc(this.#states, 'client', STORE.Event, filterEvent, date),
			take(1),
		)
	}
}