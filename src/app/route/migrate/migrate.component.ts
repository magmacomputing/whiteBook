import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map, retry } from 'rxjs/operators';
import { Store } from '@ngxs/store';

import { ForumService } from '@service/forum/forum.service';
import { MemberService } from '@service/member/member.service';
import { AttendService } from '@service/member/attend.service';
import { cleanNote } from '@route/forum/forum.library';
import { Migration } from '@route/migrate/migrate.define';

import { DataService } from '@dbase/data/data.service';
import { COLLECTION, FIELD, STORE, BONUS, CLASS, PRICE, PAYMENT, PLAN, SCHEDULE } from '@dbase/data.define';
import type { Register, Payment, Schedule, Event, Calendar, Attend, Migrate, FireDocument, Gift, Plan, Price, ProfilePlan, Bonus, Comment, Sheet } from '@dbase/data.schema';
import { LoginAction } from '@dbase/state/auth.action';
import { AccountState, AdminState } from '@dbase/state/state.define';
import { memberAction } from '@dbase/state/state.action';
import { StateService } from '@dbase/state/state.service';
import { fire } from '@dbase/fire/fire.library';

import { Instant, getInstant, getStamp, fmtInstant } from '@library/instant.library';
import { cloneObj, getPath } from '@library/object.library';
import { isUndefined, isNull, isBoolean, TString, isEmpty } from '@library/type.library';
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
	#status!: Record<string, any>;
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
			this.data.getStore<Schedule>(STORE.schedule),
			this.data.getStore<Calendar>(STORE.calendar, fire.addWhere(FIELD.type, 'Closed', '!=')),
			this.data.getStore<Event>(STORE.event, fire.addWhere(FIELD.type, 'special')),
		]).then(([schedule, calendar, event]) => {
			this.#schedule = schedule;
			this.#calendar = calendar;
			this.#event = event.groupBy(true, FIELD.key);
		})
	}

	ngOnInit() { }

	ngOnDestroy() { }

	/**
	 * Very drastic:  remove all references to a Member  
	 * uses getFire() to delete directly from Firestore (and not from State)
	 */
	async delUser() {
		const where = fire.addWhere(FIELD.uid, this.#current!.uid);
		const deletes = await Promise.all([
			this.data.getFire<FireDocument>(COLLECTION.member, { where }),
			this.data.getFire<FireDocument>(COLLECTION.admin, { where }),
			this.data.getFire<FireDocument>(COLLECTION.attend, { where }),
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
				.filter(row => row[STORE.sheet])
				.filter(row => !!row.register[FIELD.hidden] === this.filter.hidden)
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
				this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: Migration.History[], status: {} }) => {
						this.#status = resp.status;
						return (resp.history || []).orderBy(FIELD.stamp);
					})
					.then(history => this.#history.resolve(history))
				this.#history.promise
					.then(hist => this.#dbg('history: %s, %j', hist.length, this.#status))
					.catch(err => this.#dbg('err: %j', err.message))

				this.account$ = this.state.getAccountData();
				this.#dflt = CLASS.Zumba;
				this.hide = register[FIELD.hidden]
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
		const reg = (await this.data.getStore<Register>(STORE.register, fire.addWhere(FIELD.uid, this.#current!.uid)))[0];
		reg[FIELD.hidden] = reg[FIELD.hidden]
			? undefined
			: true
		this.hide = reg[FIELD.hidden]
			? 'Un'
			: ''
		return this.data.updDoc(STORE.register, reg[FIELD.id], { ...reg });
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
			this.data.getStore<Payment>(STORE.payment, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.data.getStore<Gift>(STORE.gift, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.data.getStore<ProfilePlan>(STORE.profile, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.data.getStore<Plan>(STORE.plan),
			this.data.getStore<Price>(STORE.price),
			this.data.getStore<Comment>(STORE.comment, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.#history.promise,
		])
	}

	// Analyze all the 'debit' rows, in order to build a corresponding Payment record
	async addPayment() {
		const [payments, gifts, profile, plans, prices, comments, hist = []] = await this.getMember();
		const updates: FireDocument[] = [];
		const creates: FireDocument[] = hist
			.filter(row => (row.type === 'Debit' && !(row.note?.toUpperCase().startsWith('Auto-Approve Credit '.toUpperCase())) || row.type === 'Credit'))
			.filter(row => {
				const match = payments.find(pay => pay[FIELD.stamp] === row[FIELD.stamp]);

				if (!isUndefined(row.approved)) {
					if (match && isUndefined(match.approve)) {
						match.approve = {
							stamp: row.approved,
							uid: Migration.Instructor,
						}
						updates.push(match);																		// update the now-approved Payment
						return false;																						// no further checking required on this Payment
					}
				} else if (isUndefined(match))
					this.#dbg('warn; unapproved: %j', row);										// warn if first-time migrated

				return isUndefined(match);
			})
			.map(row => {
				const approve = { stamp: 0, uid: '' };
				const payType = row.type !== 'Debit' || (row.note && row.note.toUpperCase().startsWith('Write-off'.toUpperCase())) ? PAYMENT.debit : PAYMENT.topUp;

				if (row.title.toUpperCase().startsWith('Approved: '.toUpperCase())) {
					Object.assign(approve, {
						stamp: row.approved!,
						uid: Migration.Instructor,
					})
				}

				if (payType === PAYMENT.topUp) {
					row.debit = undefined;
				} else {
					row.debit = row.credit;
					row.credit = undefined;
				}

				if (row.hold && row.hold <= 0) {
					row.debit = asString(row.hold);
					row.hold = undefined;
					if (row.note && row.note.toUpperCase().startsWith('Request for '.toUpperCase()))
						row.note = 'Write-off part topUp amount';
				}
				if (row.debit === undefined && row.credit === undefined)
					throw new Error(`cannot find amount: ${JSON.stringify(row)}`)

				const obj = {
					[FIELD.store]: STORE.payment,
					[FIELD.type]: payType,
					[FIELD.stamp]: row.stamp,
					[FIELD.note]: row.note,
					hold: row.hold,
					amount: payType === PAYMENT.topUp ? parseFloat(row.credit!) : undefined,
					adjust: row.debit && parseFloat(row.debit),
					approve: approve.stamp && approve || undefined,
					expiry: this.getExpiry(row, profile, plans, prices),
				} as Partial<Payment>
				return obj as FireDocument;
			})

		// parse the Attends to look for 'Gift' notes to create Gift documents
		let giftCnt = 0;
		let start = 0;
		let rest: string | undefined = undefined;
		hist
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.filter(row => row.note && row.debit && parseFloat(row.debit) === 0 && row.note.includes('Gift #'))
			.forEach(row => {
				const search = (row.note && row.note.lastIndexOf('Gift #') + 6) || 0;		// find the start of the pattern
				const match = search && row.note!.substring(search).match(/\d+/g);	// array of the 'digits' at the pattern
				if (match) {
					const nbr = parseInt(match[0]);																		// TODO: this should be the last element?
					if (nbr === 1) {
						if (giftCnt && start && !gifts.find(row => row[FIELD.stamp] === start))
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

		if (giftCnt && !gifts.find(row => row[FIELD.stamp] === start))
			creates.push(this.setGift(giftCnt, start, rest));

		this.data.batch(creates, updates, undefined, memberAction.Set)
			.then(_ => this.member.updAccount())
			.then(_ => this.#dbg('payment: %s, %s', creates.length, updates.length))
	}

	/** Watch Out !   This routine is a copy from the MemberService.calcExpiry() */
	private getExpiry(row: Migration.History, profile: ProfilePlan[], plans: Plan[], prices: Price[]) {
		const prof = asAt(profile, fire.addWhere(FIELD.type, STORE.plan), row.stamp)[0];
		const plan = asAt(plans, fire.addWhere(FIELD.key, prof.plan), row.stamp)[0];
		const curr = asAt(prices, fire.addWhere(FIELD.key, prof.plan), row.stamp);
		const topUp = curr.find(row => row[FIELD.type] === PRICE.topUp && row[FIELD.key] === prof.plan);
		const paid = parseFloat(row.credit || '0') + parseFloat(row.debit || '0');
		let expiry: number | undefined = undefined;

		if (topUp && !isUndefined(plan.expiry)) {
			const offset = topUp.amount
				? Math.round(paid / (topUp.amount / plan.expiry)) || 1
				: plan.expiry;
			expiry = getInstant(row.approved || row.stamp)
				.add(offset, 'months')
				.add(row.hold ?? 0, 'days')
				.startOf('day')
				.ts
			if (row.debit && parseFloat(row.debit) < 0) expiry = undefined;
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
			[FIELD.effect]: offset,
			[FIELD.store]: STORE.gift,
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
			this.data.getStore<Migrate>(STORE.migrate, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.data.getStore<Attend>(STORE.attend, fire.addWhere(FIELD.uid, this.#current!.uid)),
		])
		this.#migrate = migrate;
		const table = history.filter(row => row.type !== 'Debit' && row.type !== 'Credit');
		const start = attend.orderBy({ field: 'track.date', dir: 'desc' });		// attendance, by descending date
		const preprocess = cloneObj(table);

		if (start[0]) {																	// this is not fool-proof.   SpecialEvent, 3Pack
			const startFrom = start[0].track.date;
			const startAttend = start.filter(row => row.track.date === startFrom).map(row => row.timetable[FIELD.key]);
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
		const caldr = asAt(this.#calendar, [fire.addWhere(FIELD.key, row.date), fire.addWhere(STORE.location, 'norths', '!=')], row.date)[0];
		const calDate = caldr && getInstant(caldr[FIELD.key]);
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
				rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + nbr - 1 });
				if (flag) this.#dbg('splice: %j', row.type);
			}
			sfx = `-1.${sfx}`;
		}

		if (Migration.PACK.includes(prefix)) {
			const [plan, prices, bonus] = await Promise.all([
				this.data.getStore<ProfilePlan>(STORE.profile, [fire.addWhere(FIELD.type, STORE.plan), fire.addWhere(FIELD.uid, this.#current!.user.uid)], now),
				this.data.getStore<Price>(STORE.price, undefined, now),
				this.data.getStore<Bonus>(STORE.bonus, undefined, now),
			])
			const obj = prices
				.filter(row => row[FIELD.key] === plan[0].plan)
				.groupBy<PRICE>(true, FIELD.type)						// only one price will match
			const sunday = bonus.find(row => row[FIELD.key] === BONUS.sunday);
			if (isUndefined(sunday))
				throw new Error(`Cannot find a Sunday bonus: ${now.format('yyyymmdd')}`);
			const free = asArray(sunday.free as TString);

			this.getElect(row);														// did the Member elect to use a different Bonus?
			if (row.elect) {
				obj.full.amount = 0;
				price = 0;
			} else {
				price -= obj.full.amount + 0;								// calc the remaining price, after deduct MultiStep
				row.elect = BONUS.sunday;										// dont elect to skip Bonus on a Pack
			}

			rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + 2, [FIELD.type]: CLASS.Zumba, debit: '-' + (free.includes(CLASS.Zumba) ? 0 : Math.abs(price)).toString() });
			rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + 1, [FIELD.type]: CLASS.ZumbaStep, debit: '-' + (free.includes(CLASS.ZumbaStep) ? 0 : Math.abs(price)).toString() });
			what = CLASS.MultiStep;
			price = obj.full.amount;											// set this row's price to MultiStep
		}

		switch (true) {
			case Migration.SPECIAL.includes(prefix):								// special event match by <colour>, so we need to prompt for the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				event = this.#event[caldr[FIELD.type]];
				migrate = this.lookupMigrate(caldr[FIELD.key]);

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
					[FIELD.store]: STORE.calendar, [FIELD.type]: SCHEDULE.event, [FIELD.id]: caldr[FIELD.id], [FIELD.key]: what,
					day: calDate.dow, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: row.note,
				}
				break;

			case (!isUndefined(caldr) && !row.elect):			// special event match by <date>, so we already know the 'class'
				event = this.#event[caldr[FIELD.type]];
				if (what === CLASS.MultiStep && !event.agenda.includes(what))
					what = CLASS.SingleStep;

				if (!event.agenda.includes(what)) {
					migrate = this.lookupMigrate(caldr[FIELD.key]);
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
					[FIELD.store]: STORE.calendar, [FIELD.type]: SCHEDULE.event, [FIELD.id]: caldr[FIELD.id], [FIELD.key]: what,
					day: getInstant(caldr[FIELD.key]).dow, start: '00:00', location: caldr.location, instructor: caldr.instructor,
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

				sched = nearAt(this.#schedule, fire.addWhere(FIELD.key, className), row.stamp, { start: hhmi });
				if (!sched)
					throw new Error(`Cannot determine schedule: ${className}`);
				sched.amount = price;											// to allow AttendService to check what was charged
				sched.note = row.note;
				break;

			default:
				const where = [
					fire.addWhere(FIELD.key, what),
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
				sched.elect = BONUS.none;									// Member elected to not receive a Bonus
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
							fire.addWhere(FIELD.uid, this.#current!.uid),
							fire.addWhere('track.class', sched[FIELD.key]),
							fire.addWhere('track.date', new Instant(row.stamp).format(Instant.FORMAT.yearMonthDay)),
						]
						this.data.getFire<Comment>(COLLECTION.forum, { where })
							.then(list => {
								if (!list.length)
									this.forum.setComment({ [FIELD.key]: sched[FIELD.id], [FIELD.type]: sched[FIELD.store], [FIELD.date]: row.stamp, track: { class: caldr && caldr.name || sched[FIELD.key] }, comment })
								resolve(true);
							})
					}
					else resolve(false);
				}))
				.then(_ => p.resolve(flag))
		} else {
			p.resolve(flag)
			if (!rest.length)														// queue is empty
				this.#check.resolve(true);									// mark 'check phase' complete
		}

		p.promise
			.then(_ => this.nextAttend(flag, rest[0], ...rest.slice(1)))
	}

	private getElect(row: Migration.History) {
		if (!row.note)
			return;
		if (row.note.includes('elect false')) {
			row.elect = BONUS.none;
		} else if (row.note.includes('elect none')) {
			row.elect = BONUS.none;
		} else if (row.note.includes('Gift #')) {
			row.elect = BONUS.gift;
		} else if (row.note.toUpperCase().includes('Bonus: Week Level reached'.toUpperCase())) {
			row.elect = BONUS.week;											// Week bonus takes precedence
		} else if (row.note.toUpperCase().includes('Bonus: Class Level reached'.toUpperCase())) {
			row.elect = BONUS.class;
		} else if (row.note.toUpperCase().includes('Bonus: Month Level reached'.toUpperCase())) {
			row.elect = BONUS.month;
		} else if (row.note.toUpperCase().includes('Bonus: Sunday Level reached'.toUpperCase())) {
			row.elect = BONUS.sunday;
		} else if (row.note.toUpperCase().includes('Multiple @Home classes today'.toUpperCase())) {
			row.elect = BONUS.home;
		}
	}

	private lookupMigrate(key: string | number, type: string = STORE.event) {
		return this.#migrate
			.find(row => row[FIELD.key] === asString(key)) || {
				[FIELD.id]: this.data.newId,
				[FIELD.store]: STORE.migrate,
				[FIELD.type]: type as STORE.class | STORE.event,
				[FIELD.key]: asString(key),
				[FIELD.uid]: this.#current!.uid,
				attend: {}
			} as Migrate
	}

	private writeMigrate(migrate: Migrate) {
		const where = fire.addWhere(FIELD.uid, this.#current!.uid);

		return this.data.setDoc(STORE.migrate, migrate)
			.then(_ => this.data.getStore<Migrate>(STORE.migrate, where))
			.then(res => this.#migrate = res);
	}

	private async lastAttend() {
		const [summary, profile, active, history] = await Promise.all([
			this.member.getAmount(),								// get closing balance
			this.member.getPlan(),									// get final Plan
			this.data.getStore<Payment>(STORE.payment, fire.addWhere(FIELD.uid, this.#current!.uid)),
			this.#history.promise,
		]);

		this.#dbg('history: %j', history.reduce((prev: any, curr: any) => {
			if (curr.type === 'Debit')
				prev.paid += parseFloat(curr.credit)
			else prev.spend += parseFloat(curr.debit)
			return prev;
		}, { paid: 0, spend: 0 }))

		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];
		const closed = active[0] && active[0].expiry;

		this.#dbg('account: %j', summary);					// the current account summary
		active.orderBy({ field: FIELD.stamp, dir: 'desc' });
		if (active[0][FIELD.type] === PAYMENT.debit && active[0].approve && !active[0][FIELD.expire]) {
			const test1 = active[0].expiry && active[0].expiry < getStamp();
			const test2 = summary.pend < 0;			// closed account
			const test3 = summary.funds < 0;
			if (test1 || test2 || test3) {
				const when = active[0].approve[FIELD.stamp];
				this.#dbg('closed: %j, %s', when, fmtInstant(Instant.FORMAT.display, when));
				updates.push({ ...active[0], [FIELD.effect]: active[0].stamp, [FIELD.expire]: when, bank: summary.adjust === summary.funds ? -summary.funds : summary.funds });
				updates.push({ ...active[1], [FIELD.expire]: active[0].stamp });
			}
		}

		if (active[0][FIELD.type] === PAYMENT.topUp && profile.plan === PLAN.gratis && active[0].expiry) {
			if (closed && closed < getStamp() && !active[0][FIELD.expire]) {
				this.#dbg('closed: %j, %s', closed, fmtInstant(Instant.FORMAT.display, closed));
				updates.push({ ...active[0], [FIELD.expire]: closed });
			}
		}

		this.data.batch(creates, updates, undefined, memberAction.Set)
			.then(_ => this.member.updAccount())
			.finally(() => this.#dbg('done'))
	}

	async delPayment(full = false) {
		if (!window.confirm(`Are you sure you want to delete all Payments / Attends ?`))
			return;

		const where = fire.addWhere(FIELD.uid, this.#current!.uid);
		const [attends, payments, gifts] = await Promise.all([
			this.data.getStore<Attend>(STORE.attend, where),
			this.data.getStore<Payment>(STORE.payment, [where, fire.addWhere(FIELD.store, STORE.payment)]),
			this.data.getStore<Gift>(STORE.gift, [where, fire.addWhere(FIELD.store, STORE.gift)]),
		])
		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = [...attends, ...payments, ...gifts];

		if (full)																						// full-delete of Migrate documents as well
			deletes.push(...await this.data.getStore<Migrate>(STORE.migrate, [where, fire.addWhere(FIELD.type, [STORE.event, STORE.class])]))

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

		const where = fire.addWhere(FIELD.uid, this.#current!.uid);
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
			fire.addWhere(FIELD.uid, uid),
			// fire.addWhere(FIELD.note, '', '>'),
			fire.addWhere('track.date', 20200127),
		]
		const list = await this.data.getFire<Attend>(COLLECTION.attend, { where: filter });

		// const deletes = await this.data.getFire<IComment>(COLLECTION.forum, { where: fire.addWhere(FIELD.uid, uid) });
		// await this.data.batch(undefined, undefined, deletes);

		this.#dbg('list: %j', list.length);
		this.#dbg('list: %j', list);
		list.forEach(async doc => {
			const { comment, note } = cleanNote(doc[FIELD.note]);
			this.#dbg('note: <%s> => clean: <%s>', doc[FIELD.note], note);
			if (doc[FIELD.note] !== note) {
				this.#dbg('comment: %j', comment);
				doc[FIELD.note] = note;																// replace with cleaned Note
				await Promise.all([
					this.data.updDoc(STORE.attend, doc[FIELD.id], doc),	// update Attend with cleansed Note
					this.forum.setComment({															// add Comment to /forum
						type: STORE.schedule,
						key: doc.timetable[FIELD.id],
						date: doc.stamp,
						track: { class: doc.timetable[FIELD.key] },
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
