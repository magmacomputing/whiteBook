import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map, retry } from 'rxjs/operators';
import { Store } from '@ngxs/store';

import { ForumService } from '@service/forum/forum.service';
import { MemberService } from '@service/member/member.service';
import { AttendService } from '@service/member/attend.service';
import { calcPayment } from '@service/member/member.library';
import { cleanNote } from '@route/forum/forum.library';
import { Migration } from '@route/migrate/migrate.define';

import { DataService } from '@dbase/data/data.service';
import { COLLECTION, FIELD, STORE, BONUS, CLASS, PRICE, PAYMENT, PLAN, SCHEDULE } from '@dbase/data.define';
import type { Register, Payment, Schedule, Event, Calendar, Attend, Migrate, FireDocument, Gift, Plan, Price, ProfilePlan, Bonus, Comment, Sheet, Profile } from '@dbase/data.schema';
import { LoginAction } from '@dbase/state/auth.action';
import { AccountState, AdminState } from '@dbase/state/state.define';
import { memberAction } from '@dbase/state/state.action';
import { StateService } from '@dbase/state/state.service';
import { fire } from '@dbase/fire/fire.library';

import { Instant, getInstant, getStamp, fmtInstant } from '@library/instant.library';
import { cloneObj, getPath } from '@library/object.library';
import { isUndefined, isNull, isBoolean, TString, isEmpty, isDefined } from '@library/type.library';
import { asString, asNumber } from '@library/string.library';
import { Pledge } from '@library/utility.library';
import { Storage } from '@library/browser.library';
import { asAt, nearAt } from '@library/app.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-migrate',
	templateUrl: './migrate.component.html',
})
export class MigrateComponent implements OnInit, OnDestroy {
	#dbg = dbg(this, 'MigrateComponent');

	public dash$!: Observable<AdminState["dash"]>;
	public account$!: Observable<AccountState>;
	public sheet: Sheet | null = null;
	public filter = {} as Storage.AdminStore["migrate"];
	public hide = 'Un';																				// prefix for the <hide> UI button

	#check!: Pledge<boolean>;
	#history: Pledge<Migration.History[]>;
	#migrate!: Migrate[];
	#current: Register | null = null;
	#dflt!: CLASS;

	#schedule!: Schedule[];																		// stash current Schedule[]
	#calendar!: Calendar[];																		// stash current Calendar[]
	#event!: Record<string, Event>;													// stash current Event[] as lookup

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private change: ChangeDetectorRef,
		private member: MemberService, private store: Store, private attend: AttendService, private forum: ForumService) {
		this.#history = new Pledge();
		this.setFilter();																				// restore the previous filter state

		Promise.all([																						// fetch required Stores
			this.data.getStore<Schedule>(STORE.Schedule),
			this.data.getStore<Calendar>(STORE.Calendar, fire.addWhere(FIELD.Type, 'Closed', '!=')),
			this.data.getStore<Event>(STORE.Event, fire.addWhere(FIELD.Type, 'special')),
		]).then(([schedule, calendar, event]) => {
			this.#schedule = schedule;
			this.#calendar = calendar;
			this.#event = event.groupBy(true, FIELD.Key);
		})
	}

	ngOnInit() { }

	ngOnDestroy() { }

	/**
	 * Very drastic:  remove all references to a Member  
	 * uses getFire() to delete directly from Firestore (and not from State)
	 */
	async delUser() {
		const where = fire.addWhere(FIELD.Uid, this.#current!.uid);
		const deletes = await Promise.all([
			this.data.getFire<FireDocument>(COLLECTION.Member, { where }),
			this.data.getFire<FireDocument>(COLLECTION.Admin, { where }),
			this.data.getFire<FireDocument>(COLLECTION.Attend, { where }),
			// this.data.getFire<IStoreMeta>(COLLECTION.forum, { where }),
		]);

		return this.data.batch(undefined, undefined, deletes.flat());
	}

	/**
	 * Filter the Members to show on Admin panel  
	 * 	'hide'		toggle shows 'hidden' Members  
	 *  'credit'	toggle shows Members with $0 credit
	 */
	public setFilter(key?: 'hide' | 'credit') {
		const admin = Storage.local.get(Storage.Admin, {} as Storage.AdminStore);
		this.filter = Object.assign(												// extract the 'filter' from AdminStore
			{ hidden: false, credit: Migration.CREDIT.all },
			admin.migrate
		)

		this.dash$ = this.state.getAdminData().pipe(
			map(data => data.dash
				.filter(row => row[STORE.Sheet])
				.filter(row => !!row.register[FIELD.Hidden] === this.filter.hidden)
				.filter(row => {
					switch (this.filter.credit) {
						case Migration.CREDIT.all:
							return true;
						case Migration.CREDIT.value:
							return getPath(row.account, 'summary.credit');
						case Migration.CREDIT.zero:
							return !getPath(row.account, 'summary.credit');
					}
				})
			),
		)

		switch (key) {
			case 'hide':
				this.filter.hidden = !this.filter.hidden;
				break;
			case 'credit':
				this.filter.credit += 1;
				if (this.filter.credit >= Object.keys(Migration.CREDIT).length / 2)
					this.filter.credit = 0;
				break;
		}

		Object.assign(admin, { migrate: { ...this.filter } });
		Storage.local.set(Storage.Admin, admin);								// persist settings
	}

	async signIn(register: Register, sheet: Sheet) {
		this.#history = new Pledge<Migration.History[]>();								// quickly remove previous member's History[]							
		if (this.#current?.user.customClaims!.alias === register.user.customClaims!.alias)
			return this.signOut();																// <click> on picture will signIn / signOut
		this.#current = register;																// stash current Member
		this.sheet = sheet;																			// stash Members Import sheet

		this.store.dispatch(new LoginAction.Other(register.uid))
			.pipe(take(1))
			.subscribe(async _other => {
				const action = 'history,status';
				const { id, provider } = sheet.providers![0];
				let status: Record<string, any> = {};
				this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: Migration.History[], status: {} }) => {
						status = resp.status;
						return (resp.history || []).orderBy(FIELD.Stamp);
					})
					.then(history => this.#history.resolve(history))
				this.#history.promise
					.then(hist => this.#dbg('history: %s, %j', hist.length, status))
					.catch(err => this.#dbg('err: %j', err.message))

				this.account$ = this.state.getAccountData();
				this.#dflt = CLASS.Zumba;
				this.hide = register[FIELD.Hidden]
					? 'Un'
					: ''
				this.change.detectChanges();
			});
	}

	async signOut() {																							// signOut of 'on-behalf' mode
		this.#current = null;
		this.sheet = null;
		this.hide = '';

		this.store.dispatch(new LoginAction.Other());
	}

	/**
	 * toggle the '_hidden' boolean on /admin/register
	 */
	async hideUser() {
		const reg = (await this.data.getStore<Register>(STORE.Register, fire.addWhere(FIELD.Uid, this.#current!.uid)))[0];
		reg[FIELD.Hidden] = reg[FIELD.Hidden]
			? undefined
			: true
		this.hide = reg[FIELD.Hidden]
			? 'Un'
			: ''
		return this.data.updDoc(STORE.Register, reg[FIELD.Id], { ...reg });
	}

	/**
	 * calculate new summary, and batch into /member/status/account
	 */
	async setAccount() {
		const creates: FireDocument[] = [],
			updates: FireDocument[] = [];

		await this.member.setAccount(creates, updates);

		return this.data.batch(creates, updates);
	}

	get credit() {
		return Migration.CREDIT;
	}

	/** get the data needed to migrate a Member */
	private getMember() {
		return Promise.all([
			this.data.getStore<Payment>(STORE.Payment, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.data.getStore<Profile>(STORE.Profile, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.data.getStore<Gift>(STORE.Gift, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.data.getStore<Plan>(STORE.Plan),
			this.data.getStore<Price>(STORE.Price),
			this.data.getStore<Comment>(STORE.Comment, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.#history.promise,
		])
	}

	// Analyze all the 'debit' rows, in order to build a corresponding Payment record
	async addPayment() {
		const [payments, profiles, gifts, plans, prices, comments, hist = []] = await this.getMember();
		const histMap: Migration.History[] = [];
		const updates: FireDocument[] = [];
		const creates: FireDocument[] = hist
			.filter(row => (row.type === 'Debit' && !(row.note?.toUpperCase().startsWith('Auto-Approve Credit '.toUpperCase())) || row.type === 'Credit'))
			.filter(row => {
				const match = payments.find(pay => pay[FIELD.Stamp] === row[FIELD.Stamp]);

				if (isDefined(row.approved) && match) {
					const topUp = match.fee
						.filter(fee => fee[FIELD.Type] === PAYMENT.TopUp)				// all topUp fees on the migrated-Payment
						.filter(fee => isUndefined(fee[FIELD.Stamp]))						// find unapproved fees
					if (topUp.length) {																				// update an already-migrated Payment
						topUp.forEach(fee => {
							fee.stamp = row.approved!;														// stamp unapproved topUps
							fee.uid = Migration.Instructor
						})
						updates.push(match);																		// update the now-approved Payment
						return false;																						// no further checking required on this Payment
					}
				}

				if (isUndefined(match)) {
					if (isUndefined(row.approved))
						this.#dbg('warn; unapproved: %j', row);									// warn that you will need to re-migrate Payment later

					histMap.push(row);																				// stash payments and expirys
					if (row.note?.startsWith('Credit Expired'))
						return false;																						// skip Credit-Expired for now

					return true;																							// only return new Payments

				}
				else return false;																					// already migrated this Payment
			})
			.map(row => {
				const payType = row.type !== 'Debit' || (row.note?.toUpperCase().startsWith('Write-off'.toUpperCase())) ? PAYMENT.Adjust : PAYMENT.TopUp;
				const fee: Payment["fee"] = [{ [FIELD.Type]: payType, amount: asNumber(row.credit) }];	// start unapproved

				if (row.title.toUpperCase().startsWith('Approved: '.toUpperCase())) {
					Object.assign(fee[0], {																		// then fill-in approve
						stamp: row.approved!,
						uid: Migration.Instructor,
					})
				}

				// if (payType === PAYMENT.topUp) {														// flip debit/credit
				// 	row.debit = undefined;
				// } else {
				// 	row.debit = row.credit;
				// 	row.credit = undefined;
				// }

				if (row.hold && row.hold <= 0) {
					fee.push({
						[FIELD.Type]: PAYMENT.Hold,
						[FIELD.Uid]: Migration.Instructor,												// assume 'Hold' requests are auto-approved
						[FIELD.Stamp]: row.stamp,
						amount: asString(row.hold),
						note: row.note,
					})
					// row.debit = asString(row.hold);
					// row.hold = undefined;
					// if (row.note?.toUpperCase().startsWith('Request for '.toUpperCase()))
					// 	// row.note = 'Write-off part topUp amount';
					// 	fee[1].note = 'Write-off part topUp amount';						// TODO: this does not belong on fee.HOLD.note
				}
				if (row.debit === undefined && row.credit === undefined)
					throw new Error(`cannot find amount: ${JSON.stringify(row)}`)

				const obj: Partial<Payment> = {
					[FIELD.Store]: STORE.Payment,
					[FIELD.Stamp]: row.stamp,
					[FIELD.Note]: row.note,
					fee,
					// amount: payType === PAYMENT.topUp ? asNumber(row.credit!) : undefined,
					// adjust: row.debit && asNumber(row.debit),
					// approve: approve.stamp && approve || undefined,
					expiry: this.getExpiry(row, profiles, plans, prices),
				}
				return obj as FireDocument;
			})

		// parse the Payments to look for 'Credit Expired' adjustments
		hist
			.filter(row => row.note?.startsWith('Credit Expired'))
			.forEach(row => {
				const idx = histMap.findIndex(doc => row.stamp === doc.stamp);
				if (idx === -1)
					throw new Error('Cannot find Credit-Expired row');
				if (idx === 0)
					throw new Error('Cannot make Credit Expired adjustment on first Payment');

				const payment = creates.find(doc => doc[FIELD.Stamp] === histMap[idx - 1].stamp) as Payment;
				if (isUndefined(payment))
					throw new Error('Cannot locate the Payment prior to Credit Expired');

				payment.fee.push({
					[FIELD.Type]: PAYMENT.Adjust,
					[FIELD.Note]: row.note,
					[FIELD.Uid]: Migration.Instructor,
					[FIELD.Stamp]: histMap[idx].stamp,
					amount: asNumber(histMap[idx].credit),
				})

				// payment[FIELD.Note] = `${row.note}: ${new Instant(row.stamp).format(Instant.FORMAT.dayTime)}`;
			})

		// parse the Attends to look for 'Gift' notes to create Gift documents
		let giftCnt = 0;
		let start = 0;
		let rest: string | undefined = undefined;
		hist
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.filter(row => row.note && row.debit && asNumber(row.debit) === 0 && row.note.includes('Gift #'))
			.forEach(row => {
				const search = (row.note && row.note.lastIndexOf('Gift #') + 6) || 0;		// find the start of the pattern
				const match = search && row.note!.substring(search).match(/\d+/g);	// array of the 'digits' at the pattern
				if (match) {
					const nbr = parseInt(match[0]);																		// TODO: this should be the last element?
					if (nbr === 1) {
						if (giftCnt && start && !gifts.find(row => row[FIELD.Stamp] === start))
							creates.push(this.setGift(giftCnt, start, rest));

						giftCnt = 0;
						rest = row.note!
							.substring(search + match[0].length)
							// .replace(/[^\x20-\x7E]/g, '')
							.trim();
						if (rest && (rest.startsWith(':') || rest.startsWith(',')))
							rest = rest.substring(1).trim();
						start = row.stamp;
					}
					if (nbr > giftCnt)
						giftCnt = nbr;
				}
			})

		if (giftCnt && !gifts.find(row => row[FIELD.Stamp] === start))
			creates.push(this.setGift(giftCnt, start, rest));

		this.data.batch(creates, updates, undefined, memberAction.Set)
			.then(_ => this.member.updAccount())
			.then(_ => this.#dbg('payment: %s, %s', creates.length, updates.length))
	}

	/** Watch Out !   This routine is a copy from the MemberService.calcExpiry() */
	private getExpiry(row: Migration.History, profiles: Profile[], plans: Plan[], prices: Price[]) {
		const profile = asAt(profiles, fire.addWhere(FIELD.Type, STORE.Plan), row.stamp)[0] as ProfilePlan;
		const plan = asAt(plans, fire.addWhere(FIELD.Key, profile.plan), row.stamp)[0];
		const curr = asAt(prices, fire.addWhere(FIELD.Key, profile.plan), row.stamp);
		const topUp = curr.find(row => row[FIELD.Type] === PRICE.TopUp && row[FIELD.Key] === profile.plan);
		const paid = asNumber(row.credit || '0') + asNumber(row.debit || '0');
		let expiry: number | undefined = undefined;

		if (topUp && isDefined(plan.expiry)) {						// if Price has a topUp value, and Plan has expiry value
			const offset = topUp.amount											// calc number of months before Payment will expire
				? Math.round(paid / (topUp.amount / plan.expiry)) || 1
				: plan.expiry;
			expiry = getInstant(row.approved || row.stamp)
				.add(offset, 'months')												// add calc'd months
				.add(row.hold ?? 0, 'days')										// plus held days
				.startOf('day')																// beginning of the day
				.ts																						// as timestamp
			if (row.debit && asNumber(row.debit) < 0)
				expiry = undefined;														// but if negative, unset expiry
		}

		return expiry;
	}

	// a Gift is effective from the start of day, unless there is a 'start: <HH:MM>' note
	private setGift(gift: number, start: number, note?: string) {
		const day = getInstant(start).startOf('day');

		let offset = day.ts;
		if (note?.includes('start: '))
			offset = this.matchTime(note, day, 'end');

		let expiry: number | undefined;
		if (note?.includes('end: '))
			expiry = this.matchTime(note, day, 'end');

		const doc: Partial<Gift> = {
			[FIELD.Effect]: offset,
			[FIELD.Store]: STORE.Gift,
			stamp: start,
			limit: gift,
			note,
			expiry,
		}

		return doc as FireDocument;
	}

	private matchTime(note: string, day: Instant, search: 'start' | 'end') {
		const startPos = note.indexOf(`${search}: `);
		const time = note
			.substring(startPos, search.length + 1)
			.match(/\d\d:\d\d+/g)

		const hhmm = isNull(time)
			? [0, 0]
			: time[0].split(':').map(asNumber)

		return day
			.add(hhmm[0], 'hours')
			.add(hhmm[1], 'minutes')
			.ts
	}

	/** Add Attendance records for a Member */
	public async addAttend() {
		const history = await this.#history.promise;
		const [migrate, attend] = await Promise.all([
			this.data.getStore<Migrate>(STORE.Migrate, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.data.getStore<Attend>(STORE.Attend, fire.addWhere(FIELD.Uid, this.#current!.uid)),
		])
		this.#migrate = migrate;
		const table = history.filter(row => row.type !== 'Debit' && row.type !== 'Credit');
		const start = attend.orderBy({ field: 'track.date', dir: 'desc' });		// attendance, by descending date
		const preprocess = cloneObj(table);

		if (start[0]) {																	// this is not fool-proof.   SpecialEvent, 3Pack
			const startFrom = start[0].track.date;
			const startAttend = start.filter(row => row.track.date === startFrom).map(row => row.timetable[FIELD.Key]);
			this.#dbg('startFrom: %s, %j', startFrom, startAttend);
			const offset = table.filter(row => row.date < startFrom || (row.date === startFrom && startAttend.includes((Migration.LOOKUP[row.type] || row.type)))).length;
			table.splice(0, offset);
		}

		// const endAt = new Instant('2019-Dec-31').format(Instant.FORMAT.yearMonthDay);
		// const endPos = table.filter(row => row.date >= endAt).length;
		// table.splice(table.length - endPos);							// up-to, but not including endAt
		// this.dbg('endAt: %s, %j', endAt, table.length);

		if (table.length) {
			this.#check = new Pledge();
			this.nextAttend(false, preprocess[0], ...preprocess.slice(1));
			this.#check.promise														// wait for pre-process to complete
				.then(_ready => this.#dbg('ready: %j', _ready))
				.then(_ready => this.nextAttend(true, table[0], ...table.slice(1)))	// fire initial Attend
		} else this.#dbg('nothing to load');
	}

	private async nextAttend(flag: boolean, row: Migration.History, ...rest: Migration.History[]) {
		if (!row) {
			if (flag)
				this.lastAttend();
			return this.#dbg('done: %s', flag);
		}
		if (flag) this.#dbg('hist: %j', row);

		let what: CLASS = Migration.LOOKUP[row.type] ?? row.type;
		const now = getInstant(row.date);
		const hhmi = getInstant(row.stamp).format(Instant.FORMAT.HHMI);

		let price = parseInt(row.debit || '0') * -1;				// the price that was charged
		const caldr = asAt(this.#calendar, [fire.addWhere(FIELD.Key, row.date), fire.addWhere(STORE.Location, 'norths', '!=')], row.date)[0];
		const calDate = caldr && getInstant(caldr[FIELD.Key]);
		const [prefix, suffix] = what.split('*');

		let sfx = suffix ? suffix.split(' ')[0] : '1';
		let sched: Schedule;
		let event: Event;
		let idx: number = 0;
		let migrate: Migrate | undefined;

		if (Migration.SPECIAL.includes(prefix) && suffix && parseInt(sfx).toString() === sfx && !sfx.startsWith('-')) {
			if (flag) this.#dbg(`${prefix}: need to resolve ${sfx} class`);
			for (let nbr = parseInt(sfx); nbr > 1; nbr--) {			// insert additional attends
				row.type = prefix + `*-${nbr}.${sfx}`;
				rest.splice(0, 0, { ...row, [FIELD.Stamp]: row.stamp + nbr - 1 });
				if (flag) this.#dbg('splice: %j', row.type);
			}
			sfx = `-1.${sfx}`;
		}

		if (Migration.PACK.includes(prefix)) {
			const [plan, prices, bonus] = await Promise.all([
				this.data.getStore<ProfilePlan>(STORE.Profile, [fire.addWhere(FIELD.Type, STORE.Plan), fire.addWhere(FIELD.Uid, this.#current!.user.uid)], now),
				this.data.getStore<Price>(STORE.Price, undefined, now),
				this.data.getStore<Bonus>(STORE.Bonus, undefined, now),
			])
			const obj = prices
				.filter(row => row[FIELD.Key] === plan[0].plan)
				.groupBy<PRICE>(true, FIELD.Type)						// only one price will match
			const sunday = bonus.find(row => row[FIELD.Key] === BONUS.Sunday);
			if (isUndefined(sunday))
				throw new Error(`Cannot find a Sunday bonus: ${now.format('yyyymmdd')}`);
			const free = asArray(sunday.free as TString);

			this.getElect(row);														// did the Member elect to use a different Bonus?
			if (row.elect) {
				obj.full.amount = 0;
				price = 0;
			} else {
				price -= obj.full.amount + 0;								// calc the remaining price, after deduct MultiStep
				row.elect = BONUS.Sunday;										// dont elect to skip Bonus on a Pack
			}

			rest.splice(0, 0, { ...row, [FIELD.Stamp]: row.stamp + 2, [FIELD.Type]: CLASS.Zumba, debit: '-' + (free.includes(CLASS.Zumba) ? 0 : Math.abs(price)).toString() });
			rest.splice(0, 0, { ...row, [FIELD.Stamp]: row.stamp + 1, [FIELD.Type]: CLASS.ZumbaStep, debit: '-' + (free.includes(CLASS.ZumbaStep) ? 0 : Math.abs(price)).toString() });
			what = CLASS.MultiStep;
			price = obj.full.amount;											// set this row's price to MultiStep
		}

		switch (true) {
			case Migration.SPECIAL.includes(prefix):								// special event match by <colour>, so we need to prompt for the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				event = this.#event[caldr[FIELD.Type]];
				migrate = this.lookupMigrate(caldr[FIELD.Key]);

				if (!migrate.attend[sfx]) {
					for (idx = 0; idx < event.agenda.length; idx++) {
						if (window.prompt(`This ${sfx} class on ${calDate.format(Instant.FORMAT.display)} for $${(parseInt(row.debit || '0') * -1).toFixed(2)}, ${caldr.name}?`, event.agenda[idx]) === event.agenda[idx])
							break;
					}
					if (idx === event.agenda.length)
						throw new Error('Cannot determine event');

					migrate.attend[sfx] = event.agenda[idx];
					await this.writeMigrate(migrate);
				}
				what = migrate.attend[sfx];

				sched = {
					[FIELD.Store]: STORE.Calendar, [FIELD.Type]: SCHEDULE.Event, [FIELD.Id]: caldr[FIELD.Id], [FIELD.Key]: what,
					day: calDate.dow, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: row.note,
				}
				break;

			case (!isUndefined(caldr) && !row.elect):			// special event match by <date>, so we already know the 'class'
				event = this.#event[caldr[FIELD.Type]];
				if (what === CLASS.MultiStep && !event.agenda.includes(what))
					what = CLASS.SingleStep;

				if (!event.agenda.includes(what)) {
					migrate = this.lookupMigrate(caldr[FIELD.Key]);
					if (!migrate.attend[what]) {
						for (idx = 0; idx < event.agenda.length; idx++) {
							if (window.prompt(`This ${what} event on ${calDate.format(Instant.FORMAT.display)} for $${(parseInt(row.debit || '0') * -1).toFixed(2)}, ${caldr.name}? (${event.agenda.map(itm => itm)})`,
								event.agenda[idx]) === event.agenda[idx])
								break;
						}
						if (idx === event.agenda.length)
							throw new Error('Cannot determine event');

						migrate.attend[what] = event.agenda[idx];
						await this.writeMigrate(migrate);
					}
					what = migrate.attend[what];
				}

				sched = {
					[FIELD.Store]: STORE.Calendar, [FIELD.Type]: SCHEDULE.Event, [FIELD.Id]: caldr[FIELD.Id], [FIELD.Key]: what,
					day: getInstant(caldr[FIELD.Key]).dow, start: '00:00', location: caldr.location, instructor: caldr.instructor,
					note: row.note, amount: price,
				}
				break;

			case prefix === 'unknown':									// no color on the cell, so guess the 'class'
				migrate = this.lookupMigrate(now.format(Instant.FORMAT.yearMonthDay));
				let className = migrate.attend.class || null;

				if (isNull(className)) {
					className = window.prompt(`This ${prefix} class on ${now.format(Instant.FORMAT.display)} for $${(parseInt(row.debit || '0') * -1).toFixed(2)}?`, this.#dflt) as CLASS;
					if (isNull(className))
						throw new Error('Cannot determine class');
					this.#dflt = className;

					migrate.attend = { class: className };
					await this.writeMigrate(migrate);
				}

				sched = nearAt(this.#schedule, fire.addWhere(FIELD.Key, className), row.stamp, { start: hhmi });
				if (!sched)
					throw new Error(`Cannot determine schedule: ${className}`);
				sched.amount = price;											// to allow AttendService to check what was charged
				sched.note = row.note;
				break;

			default:
				const where = [
					fire.addWhere(FIELD.Key, what),
					fire.addWhere('day', [Instant.WEEKDAY.All, now.dow]),
				];

				sched = nearAt(this.#schedule, where, row.stamp, { start: hhmi })
				if (isEmpty(sched))
					throw new Error(`Cannot determine schedule: ${JSON.stringify(row)}`);
				if (isUndefined(row.elect))
					this.getElect(row);
				// if (row.note?.includes('Bonus: Week Level reached'))
				// 	row.elect = BONUS.week;
				sched.amount = price;											// to allow AttendService to check what was charged
				sched.note = row.note;
				sched.elect = row.elect;
				break;
		}

		const p = new Pledge<boolean>();

		if (flag) {
			let comment: TString | undefined;
			if (row.note?.includes('elect false')) {
				sched.elect = BONUS.None;									// Member elected to not receive a Bonus
				sched.note = (row.note.length > 'elect false'.length)
					? row.note.substring('elect false'.length).trim()
					: undefined;
			} else {
				const obj = cleanNote(sched.note);				// split the row.note into sched.note and forum.comment
				comment = obj.comment;
				sched.note = obj.note;										// replace note with cleaned note
			}

			this.attend.setAttend(sched, row.stamp)
				.then(res => {
					if (isBoolean(res) && res === false)
						throw new Error('stopping');
					return res;
				})
				.then(_ => new Promise((resolve, reject) => {
					if (comment) {
						const where = [
							fire.addWhere(FIELD.Uid, this.#current!.uid),
							fire.addWhere('track.class', sched[FIELD.Key]),
							fire.addWhere('track.date', new Instant(row.stamp).format(Instant.FORMAT.yearMonthDay)),
						]
						this.data.getFire<Comment>(COLLECTION.Forum, { where })
							.then(list => {
								if (!list.length)
									this.forum.setComment({ [FIELD.Key]: sched[FIELD.Id], [FIELD.Type]: sched[FIELD.Store], [FIELD.Date]: row.stamp, track: { class: caldr && caldr.name || sched[FIELD.Key] }, comment })
								resolve(true);
							})
					}
					else resolve(false);
				}))
				.then(_ => p.resolve(flag))
		} else {
			p.resolve(flag)
			if (!rest.length)															// queue is empty
				this.#check.resolve(true);									// mark 'check phase' complete
		}

		p.promise
			.then(_ => this.nextAttend(flag, rest[0], ...rest.slice(1)))
	}

	private getElect(row: Migration.History) {
		if (!row.note)
			return;
		if (row.note.includes('elect false')) {
			row.elect = BONUS.None;
		} else if (row.note.includes('elect none')) {
			row.elect = BONUS.None;
		} else if (row.note.includes('Gift #')) {
			row.elect = BONUS.Gift;
		} else if (row.note.toUpperCase().includes('Bonus: Week Level reached'.toUpperCase())) {
			row.elect = BONUS.Week;											// Week bonus takes precedence
		} else if (row.note.toUpperCase().includes('Bonus: Class Level reached'.toUpperCase())) {
			row.elect = BONUS.Class;
		} else if (row.note.toUpperCase().includes('Bonus: Month Level reached'.toUpperCase())) {
			row.elect = BONUS.Month;
		} else if (row.note.toUpperCase().includes('Bonus: Sunday Level reached'.toUpperCase())) {
			row.elect = BONUS.Sunday;
		} else if (row.note.toUpperCase().includes('Multiple @Home classes today'.toUpperCase())) {
			row.elect = BONUS.Home;
		}
	}

	private lookupMigrate(key: string | number, type: string = STORE.Event) {
		return this.#migrate
			.find(row => row[FIELD.Key] === asString(key)) || {
				[FIELD.Id]: this.data.newId,
				[FIELD.Store]: STORE.Migrate,
				[FIELD.Type]: type as STORE.Class | STORE.Event,
				[FIELD.Key]: asString(key),
				[FIELD.Uid]: this.#current!.uid,
				attend: {}
			} as Migrate
	}

	private writeMigrate(migrate: Migrate) {
		const where = fire.addWhere(FIELD.Uid, this.#current!.uid);

		return this.data.setDoc(STORE.Migrate, migrate)
			.then(_ => this.data.getStore<Migrate>(STORE.Migrate, where))
			.then(res => this.#migrate = res);
	}

	private async lastAttend() {
		const [summary, profile, payments, history] = await Promise.all([
			this.member.getAmount(),								// get closing balance
			this.member.getPlan(),									// get final Plan
			this.data.getStore<Payment>(STORE.Payment, fire.addWhere(FIELD.Uid, this.#current!.uid)),
			this.#history.promise,
		]);

		const obj = { paid: 0, spend: 0 };
		this.#dbg('history: %j', history.reduce((prev: typeof obj, curr: Migration.History) => {
			if (curr[FIELD.Type] === 'Debit')
				prev.paid += asNumber(curr.credit)
			else prev.spend += asNumber(curr.debit)
			return prev;
		}, obj))

		this.#dbg('account: %j', summary);					// the current account summary
		payments																		// build a linked-list of Payments
			.orderBy({ field: FIELD.Stamp, dir: 'desc' }, FIELD.Type)

		const active = payments[0];
		const closed = active?.expiry;
		const updates: FireDocument[] = [];
		const amounts = calcPayment(active, true);

		if (amounts[PAYMENT.Adjust] && !active[FIELD.Expire]) {
			const test1 = active.expiry && active.expiry < getStamp();
			const test2 = summary.pend < 0;			// closed account
			const test3 = summary.funds < 0;
			if (test1 || test2 || test3) {
				const note = asArray(active.note)[asArray(active.note).length];
				const stamp = active.fee[0][FIELD.Stamp];
				const expired = active.fee.find(fee => asArray(fee.note).indexOf('Credit Expired') !== -1);
				const when = expired
					? getStamp(expired[FIELD.Stamp])
					: stamp

				this.#dbg('closed: %j, %s', when, fmtInstant(Instant.FORMAT.display, when));
				updates.push({ ...active, [FIELD.Effect]: active.stamp, [FIELD.Expire]: when, chain: undefined, bank: summary.adjust === summary.funds ? -summary.funds : summary.funds });
				updates.push({ ...payments[1], [FIELD.Expire]: active.stamp, chain: undefined });
			}
		}

		if (amounts[PAYMENT.TopUp] && profile.plan === PLAN.Gratis && active.expiry) {
			if (closed && closed < getStamp() && !active[FIELD.Expire]) {
				this.#dbg('closed: %j, %s', closed, fmtInstant(Instant.FORMAT.display, closed));
				updates.push({ ...active, [FIELD.Expire]: closed });
			}
		}

		this.data.batch(undefined, updates, undefined, memberAction.Set)
			.then(_ => this.member.updAccount())
			.finally(() => this.#dbg('done'))
	}

	async delPayment(full = false) {
		if (!window.confirm(`Are you sure you want to delete all Payments / Attends ?`))
			return;

		const where = fire.addWhere(FIELD.Uid, this.#current!.uid);
		const [attends, payments, gifts] = await Promise.all([
			this.data.getStore<Attend>(STORE.Attend, where),
			this.data.getStore<Payment>(STORE.Payment, [where, fire.addWhere(FIELD.Store, STORE.Payment)]),
			this.data.getStore<Gift>(STORE.Gift, [where, fire.addWhere(FIELD.Store, STORE.Gift)]),
		])
		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = [...attends, ...payments, ...gifts];

		if (full)																						// full-delete of Migrate documents as well
			deletes.push(...await this.data.getStore<Migrate>(STORE.Migrate, [where, fire.addWhere(FIELD.Type, [STORE.Event, STORE.Class])]))

		return this.data.batch(creates, updates, deletes, memberAction.Set)
			.then(_ => this.member.updAccount())
			.finally(() => this.#dbg('done'))
	}

	async revPayment() {
		this.#dbg('revPayment:  not implemented');
		return;
	}

	async revAttend() {
		const dt = window.prompt('From which date');
		if (dt) {
			const now = getInstant(dt);
			if (!now.isValid()) {
				window.alert(`'${dt}': Not a valid date`);
				return;
			}
			if (window.confirm(`${now.format(Instant.FORMAT.display)}: are you sure you want to delete from this date?`))
				this.attend.delAttend(fire.addWhere('track.date', now.format(Instant.FORMAT.yearMonthDay), '>='));
		}
	}

	async delAttend() {											// see AttendService.delAttend()
		if (!window.confirm(`Are you sure you want to delete all Attends ?`))
			return;

		const where = fire.addWhere(FIELD.Uid, this.#current!.uid);
		return this.attend.delAttend(where);
	}

	private async fetch(action: string, query: string) {
		const urlParams = `${Migration.SHEET_URL}?${query}&action=${action}&prefix=${Migration.SHEET_PREFIX}`;
		try {
			const res = await this.http
				.get(urlParams, { responseType: 'text' })
				.pipe(retry(2))
				.toPromise();
			const json = res.substring(0, res.length - 1).substring(Migration.SHEET_PREFIX.length + 1, res.length);
			this.#dbg('fetch: %j', urlParams);
			try {
				const obj = JSON.parse(json);
				return (action === 'history,status')
					? { ...obj.status, ...obj.history }
					: obj[action];
			}
			catch (err) {
				this.#dbg('not a valid JSON');
				return {};
			}
		}
		catch (err_1) {
			return this.#dbg('cannot fetch: %s', err_1.message);
		}
	}

	private async migrateComment() {
		const uid = 'BronwynH';
		const filter = [
			fire.addWhere(FIELD.Uid, uid),
			// fire.addWhere(FIELD.note, '', '>'),
			fire.addWhere('track.date', 20200127),
		]
		const list = await this.data.getFire<Attend>(COLLECTION.Attend, { where: filter });

		// const deletes = await this.data.getFire<IComment>(COLLECTION.forum, { where: fire.addWhere(FIELD.uid, uid) });
		// await this.data.batch(undefined, undefined, deletes);

		this.#dbg('list: %j', list.length);
		this.#dbg('list: %j', list);
		list.forEach(async doc => {
			const { comment, note } = cleanNote(doc[FIELD.Note]);
			this.#dbg('note: <%s> => clean: <%s>', doc[FIELD.Note], note);
			if (doc[FIELD.Note] !== note) {
				this.#dbg('comment: %j', comment);
				doc[FIELD.Note] = note;																// replace with cleaned Note
				await Promise.all([
					this.data.updDoc(STORE.Attend, doc[FIELD.Id], doc),	// update Attend with cleansed Note
					this.forum.setComment({															// add Comment to /forum
						type: STORE.Schedule,
						key: doc.timetable[FIELD.Id],
						date: doc.stamp,
						track: { class: doc.timetable[FIELD.Key] },
						uid,
						comment,
					})
				])
			}
		})
	}

	public parseNote() {
		const { comment, note } = cleanNote(window.prompt('Enter a note') ?? '');
		this.#dbg('comment: %s', comment);
		this.#dbg('note: %s', note);
	}
}
