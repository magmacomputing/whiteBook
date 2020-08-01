import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map, retry } from 'rxjs/operators';
import { firestore } from 'firebase/app';
import { Store } from '@ngxs/store';

import { ForumService } from '@service/forum/forum.service';
import { MemberService } from '@service/member/member.service';
import { AttendService } from '@service/member/attend.service';
import { MHistory, IAdminStore } from '@route/migrate/migrate.interface';
import { LOOKUP, PACK, SPECIAL, CREDIT, SHEET_URL, SHEET_PREFIX, INSTRUCTOR } from '@route/migrate/migrate.define';
import { cleanNote } from '@route/forum/forum.library';

import { DataService } from '@dbase/data/data.service';
import { COLLECTION, FIELD, STORE, BONUS, CLASS, PRICE, PAYMENT, PLAN, SCHEDULE } from '@dbase/data/data.define';
import { IRegister, IPayment, ISchedule, IEvent, ICalendar, IAttend, IMigrate, IStoreMeta, IGift, IPlan, IPrice, IProfilePlan, IBonus, IComment, IImport, IForum } from '@dbase/data/data.schema';
import { Login } from '@dbase/state/auth.action';
import { IAccountState, IAdminState } from '@dbase/state/state.define';
import { Member } from '@dbase/state/state.action';
import { StateService } from '@dbase/state/state.service';
import { AdminStorage } from '@dbase/sync/sync.define';
import { addWhere } from '@dbase/fire/fire.library';
import { TWhere } from '@dbase/fire/fire.interface';

import { Instant, getDate, getStamp, fmtDate } from '@library/instant.library';
import { cloneObj, getPath } from '@library/object.library';
import { isUndefined, isNull, isBoolean, TString, isEmpty } from '@library/type.library';
import { asString, asNumber } from '@library/string.library';
import { Pledge } from '@library/utility.library';
import { setLocalStore, getLocalStore } from '@library/browser.library';
import { asAt } from '@library/app.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-migrate',
	templateUrl: './migrate.component.html',
})
export class MigrateComponent implements OnInit, OnDestroy {
	private dbg = dbg(this, 'MigrateComponent');

	public dash$!: Observable<IAdminState["dash"]>;
	public account$!: Observable<IAccountState>;
	public import_: IImport | null = null;
	public admin: IAdminStore = {};
	public hide = 'Un';																				// prefix for the <hide> UI button

	private check!: Pledge<boolean>;
	private history: Pledge<MHistory[]>;
	private status!: Record<string, any>;
	private migrate!: IMigrate[];
	private current: IRegister | null = null;
	private dflt!: CLASS;

	private schedule!: ISchedule[];
	private calendar!: ICalendar[];
	private events!: Record<string, IEvent>;

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private change: ChangeDetectorRef,
		private member: MemberService, private store: Store, private attend: AttendService, private forum: ForumService) {
		this.history = new Pledge();
		this.filter();																					// restore the previous filter state

		Promise.all([																						// fetch required Stores
			this.data.getStore<ISchedule>(STORE.schedule),
			this.data.getStore<ICalendar>(STORE.calendar, addWhere(FIELD.type, 'Closed', '!=')),
			this.data.getStore<IEvent>(STORE.event, addWhere(FIELD.type, 'special')),
		]).then(([schedule, calendar, events]) => {
			this.schedule = schedule;
			this.calendar = calendar;
			this.events = events.groupBy(FIELD.key);
		})
	}

	ngOnInit() { }

	ngOnDestroy() { }

	/**
	 * Very drastic:  remove all references to a Member  
	 * uses getFire() to delete directly from Firestore (and not from State)
	 */
	async delUser() {
		const where: TWhere = addWhere(FIELD.uid, this.current!.uid);
		const deletes = await Promise.all([
			this.data.getFire<IStoreMeta>(COLLECTION.member, { where }),
			this.data.getFire<IStoreMeta>(COLLECTION.admin, { where }),
			this.data.getFire<IStoreMeta>(COLLECTION.attend, { where }),
			// this.data.getFire<IStoreMeta>(COLLECTION.forum, { where }),
		]);

		return this.data.batch(undefined, undefined, deletes.flat());
	}

	/**
	 * Filter the Members to show on Admin panel
	 * @param key <string>
	 * 	'hide'		toggle showing 'hidden' Members
	 *  'credit'	toggle showing Members with $0 credit
	 */
	public filter(key?: 'hide' | 'credit') {
		this.admin = getLocalStore(AdminStorage) || {};
		const migrateFilter = this.admin.migrateFilter || { hidden: false, idx: 2 };

		this.dash$ = this.state.getAdminData().pipe(
			map(data => data.dash
				.filter(row => row[STORE.import])
				.filter(row => !!row.register[FIELD.hidden] === migrateFilter.hidden)
				.filter(row => {
					switch (CREDIT[migrateFilter.idx]) {
						case 'all':
							return true;
						case 'value':
							return getPath(row.account, 'summary.credit');
						case 'zero':
							return !getPath(row.account, 'summary.credit');
					}
				})
			),
		)

		switch (key) {
			case 'hide':
				migrateFilter.hidden = !migrateFilter.hidden;
				break;
			case 'credit':
				migrateFilter.idx += 1;
				if (migrateFilter.idx >= CREDIT.length)
					migrateFilter.idx = 0;
				break;
		}

		setLocalStore(AdminStorage, { ...this.admin, migrateFilter });				// persist settings
	}

	async signIn(register: IRegister, import_: IImport) {
		if (this.current && this.current!.user.customClaims!.alias === register.user.customClaims!.alias)
			return this.signOut();																		// <click> on picture will signIn / signOut
		this.current = register;																		// stash current Member
		this.import_ = import_;																			// stash Members Import sheet

		this.store.dispatch(new Login.Other(register.uid))
			.pipe(take(1))
			.subscribe(async _other => {
				const action = 'history,status';
				const { id, provider } = import_.providers![0];
				this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: MHistory[], status: {} }) => {
						this.status = resp.status;
						return (resp.history || []).orderBy(FIELD.stamp);
					})
					.then(history => this.history.resolve(history))
				this.history.promise
					.then(hist => this.dbg('history: %s, %j', hist.length, this.status))
					.catch(err => this.dbg('err: %j', err.message))

				this.account$ = this.state.getAccountData();
				this.dflt = CLASS.Zumba;
				this.hide = register[FIELD.hidden]
					? 'Un'
					: ''
				this.change.detectChanges();
			});
	}

	async signOut() {																					// signOut of 'on-behalf' mode
		this.current = null;
		this.import_ = null;
		this.history = new Pledge();
		this.hide = '';

		this.store.dispatch(new Login.Other());
	}

	/**
	 * toggle the '_hidden' boolean on /admin/register
	 */
	async hideUser() {
		const reg = (await this.data.getStore<IRegister>(STORE.register, addWhere(FIELD.uid, this.current!.uid)))[0];
		reg[FIELD.hidden] = reg[FIELD.hidden]
			? firestore.FieldValue.delete()
			: true;
		this.hide = reg[FIELD.hidden]
			? 'Un'
			: ''
		return this.data.updDoc(STORE.register, reg[FIELD.id], { ...reg });
	}

	/**
	 * calculate new summary, and batch into /member/status/account
	 */
	async setAccount() {
		const creates: IStoreMeta[] = [],
			updates: IStoreMeta[] = [];

		await this.member.setAccount(creates, updates);

		return this.data.batch(creates, updates);
	}

	get credit() {
		return CREDIT;
	}

	/** get the data needed to migrate a Member */
	private async getMember() {
		return Promise.all([
			this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IGift>(STORE.gift, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IProfilePlan>(STORE.profile, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IPlan>(STORE.plan),
			this.data.getStore<IPrice>(STORE.price),
			this.data.getStore<IComment>(STORE.comment, addWhere(FIELD.uid, this.current!.uid)),
			this.history.promise,
		])
	}

	// Analyze all the 'debit' rows, in order to build a corresponding Payment record
	async addPayment() {
		const [payments, gifts, profile, plans, prices, comments, hist = []] = await this.getMember();
		const creates: IStoreMeta[] = hist
			.filter(row => (row.type === 'Debit' && !(row.note && row.note.toUpperCase().startsWith('Auto-Approve Credit '.toUpperCase())) || row.type === 'Credit'))
			.filter(row => isUndefined(payments.find(pay => pay[FIELD.stamp] === row[FIELD.stamp])))
			.filter(row => {
				if (isUndefined(row.approved))
					this.dbg('warn; unapproved: %j', row);
				return !isUndefined(row.approved);
			})
			.map(row => {
				const approve = { stamp: 0, uid: '' };
				const payType = row.type !== 'Debit' || (row.note && row.note.toUpperCase().startsWith('Write-off'.toUpperCase())) ? 'debit' : 'topUp';

				if (row.title.toUpperCase().startsWith('Approved: '.toUpperCase())) {
					approve.stamp = row.approved!;
					approve.uid = INSTRUCTOR;
				}

				if (payType === PRICE.topUp) {
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

				return {
					[FIELD.store]: STORE.payment,
					[FIELD.type]: payType,
					stamp: row.stamp,
					hold: row.hold,
					amount: payType === PRICE.topUp ? parseFloat(row.credit!) : undefined,
					adjust: row.debit && parseFloat(row.debit),
					approve: approve.stamp && approve || undefined,
					expiry: this.getExpiry(row, profile, plans, prices),
					note: row.note,
				} as IPayment
			})

		// parse the Attends to look for 'Gift' notes, and build a Gift document
		let giftCnt = 0;
		let start = 0;
		let rest: string | undefined = undefined;
		hist
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.filter(row => row.note && row.debit && parseFloat(row.debit) === 0 && row.note.includes('Gift #'))
			.forEach(row => {
				const search = (row.note && row.note.search('Gift #') + 6) || 0;		// find the start of the pattern
				const match = search && row.note!.substring(search).match(/\d+/g);	// array of the 'digits' at the pattern
				if (match) {
					const nbr = parseInt(match[0]);																		// TODO: this should be the last element?
					if (nbr === 1) {
						if (giftCnt && start && !gifts.find(row => row[FIELD.stamp] === start)) {
							creates.push(this.setGift(giftCnt, start, rest));
						}
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

		this.data.batch(creates, undefined, undefined, Member.Set)
			.then(_ => this.member.updAccount())
			.then(_ => this.dbg('payment: %s', creates.length))
	}

	/** Watch Out !   This routine is a copy from the MemberService.calcExpiry() */
	private getExpiry(row: MHistory, profile: IProfilePlan[], plans: IPlan[], prices: IPrice[]) {
		const plan = asAt(profile, addWhere(FIELD.type, STORE.plan), row.stamp)[0];
		const desc = asAt(plans, addWhere(FIELD.key, plan.plan), row.stamp)[0];
		const curr = asAt(prices, addWhere(FIELD.key, plan.plan), row.stamp);
		const topUp = curr.find(row => row[FIELD.type] === PRICE.topUp && row[FIELD.key] === plan.plan);
		const paid = parseFloat(row.credit || '0') + parseFloat(row.debit || '0');
		let expiry: number | undefined = undefined;

		if (topUp && !isUndefined(desc.expiry)) {
			const offset = topUp.amount
				? Math.round(paid / (topUp.amount / desc.expiry)) || 1
				: desc.expiry;
			expiry = getDate(row.approved || row.stamp).add(offset, 'month').add(row.hold ?? 0, 'days').startOf('day').ts;
			if (row.debit && parseFloat(row.debit) < 0) expiry = undefined;
		}

		return expiry;
	}

	// a Gift is effective from the start of day, unless there is a 'start <HH:MM>' note
	private setGift(gift: number, start: number, note?: string) {
		let offset = getDate(start).startOf('day').ts;
		if (note && note.includes('start: ')) {
			let time = note.substring(note.indexOf('start: ') + 6).match(/\d\d:\d\d+/g);
			if (!isNull(time)) {
				let hhmm = time[0].split(':');
				offset = getDate(start)
					.startOf('day')
					.add(asNumber(hhmm[0]), 'hours')
					.add(asNumber(hhmm[1]), 'minutes')
					.ts
			}
		}
		return {
			[FIELD.effect]: offset,
			[FIELD.store]: STORE.gift,
			stamp: start,
			limit: gift,
			note: note || undefined,
		} as IGift
	}

	/** Add Attendance records for a Member */
	public async addAttend() {
		const history = await this.history.promise;
		const [migrate, attend] = await Promise.all([
			this.data.getStore<IMigrate>(STORE.migrate, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IAttend>(STORE.attend, addWhere(FIELD.uid, this.current!.uid)),
		])
		this.migrate = migrate;
		const table = history.filter(row => row.type !== 'Debit' && row.type !== 'Credit');
		const start = attend.orderBy('-track.date');
		const preprocess = cloneObj(table);

		// const endAt = table.filter(row => row.date >= getDate('2017-Dec-31').format(Instant.FORMAT.yearMonthDay)).length;
		// table.splice(table.length - endAt);							// up-to, but not includng endAt

		if (start[0]) {																	// this is not fool-proof.   SpecialEvent, 3Pack
			const startFrom = start[0].track.date;
			const startAttend = start.filter(row => row.track.date === startFrom).map(row => row.timetable[FIELD.key]);
			this.dbg('startFrom: %s, %j', startFrom, startAttend);
			const offset = table.filter(row => row.date < startFrom || (row.date === startFrom && startAttend.includes((LOOKUP[row.type] || row.type)))).length;
			table.splice(0, offset);
		}
		if (table.length) {
			this.check = new Pledge();
			this.nextAttend(false, preprocess[0], ...preprocess.slice(1));
			this.check.promise														// wait for pre-process to complete
				.then(_ready => this.dbg('ready: %j', _ready))
				.then(_ready => this.nextAttend(true, table[0], ...table.slice(1)))	// fire initial Attend
		} else this.dbg('nothing to load');
	}

	private async nextAttend(flag: boolean, row: MHistory, ...rest: MHistory[]) {
		if (!row) {
			if (flag)
				this.lastAttend();
			return this.dbg('done: %s', flag);
		}
		if (flag) this.dbg('hist: %j', row);

		let what: CLASS = LOOKUP[row.type] ?? row.type;
		const now = getDate(row.date);
		const hhmi = this.asTime(getDate(row.stamp).format(Instant.FORMAT.HHMI));

		let price = parseInt(row.debit || '0') * -1;				// the price that was charged
		const caldr = asAt(this.calendar, [addWhere(FIELD.key, row.date), addWhere(STORE.location, 'norths', '!=')], row.date)[0];
		const calDate = caldr && getDate(caldr[FIELD.key]);
		const [prefix, suffix] = what.split('*');

		let sfx = suffix ? suffix.split(' ')[0] : '1';
		let sched: ISchedule;
		let event: IEvent;
		let idx: number = 0;
		let migrate: IMigrate | undefined;

		if (SPECIAL.includes(prefix) && suffix && parseInt(sfx).toString() === sfx && !sfx.startsWith('-')) {
			if (flag) this.dbg(`${prefix}: need to resolve ${sfx} class`);
			for (let nbr = parseInt(sfx); nbr > 1; nbr--) {			// insert additional attends
				row.type = prefix + `*-${nbr}.${sfx}`;
				rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + nbr - 1 });
				if (flag) this.dbg('splice: %j', row.type);
			}
			sfx = `-1.${sfx}`;
		}

		if (PACK.includes(prefix)) {
			const [plan, prices, bonus] = await Promise.all([
				this.data.getStore<IProfilePlan>(STORE.profile, [addWhere(FIELD.type, STORE.plan), addWhere(FIELD.uid, this.current!.user.uid)], now),
				this.data.getStore<IPrice>(STORE.price, undefined, now),
				this.data.getStore<IBonus>(STORE.bonus, undefined, now),
			])
			const obj = prices
				.filter(row => row[FIELD.key] === plan[0].plan)
				.groupBy<PRICE>(FIELD.type)
			const sunday = bonus.find(row => row[FIELD.key] === BONUS.sunday);
			if (isUndefined(sunday))
				throw new Error(`Cannot find a Sunday bonus: ${now.format('yyyymmdd')}`);
			const free = asArray(sunday.free as TString)

			if (row.note && (row.note.includes('Bonus: Week Level reached'))) {
				obj.full.amount = 0;
				price = 0;
				row.elect = BONUS.week;											// Week bonus takes precedence
			} else if (row.note && row.note.includes('Gift #')) {
				obj.full.amount = 0;
				price = 0;
				row.elect = BONUS.gift;											// special: accidental one-gift claimed against three class
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
			case SPECIAL.includes(prefix):								// special event match by <colour>, so we need to prompt for the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				event = this.events[caldr[FIELD.type]];
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
				event = this.events[caldr[FIELD.type]];
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
					day: getDate(caldr[FIELD.key]).dow, start: '00:00', location: caldr.location, instructor: caldr.instructor,
					note: row.note, amount: price,
				}
				break;

			case prefix === 'unknown':									// no color on the cell, so guess the 'class'
				migrate = this.lookupMigrate(now.format(Instant.FORMAT.yearMonthDay));
				let className = migrate.attend.class || null;

				if (isNull(className)) {
					className = window.prompt(`This ${prefix} class on ${now.format(Instant.FORMAT.display)} for $${(parseInt(row.debit || '0') * -1).toFixed(2)}?`, this.dflt) as CLASS;
					if (isNull(className))
						throw new Error('Cannot determine class');
					this.dflt = className;

					migrate.attend = { class: className };
					await this.writeMigrate(migrate);
				}

				sched = asAt(this.schedule, addWhere(FIELD.key, className), row.stamp)
					.reduce((near, itm) => Math.abs(this.asTime(itm.start) - hhmi) < Math.abs(this.asTime(near.start) - hhmi) ? itm : near);
				if (!sched)
					throw new Error(`Cannot determine schedule: ${className}`);
				sched.amount = price;											// to allow AttendService to check what was charged
				sched.note = row.note;
				break;

			default:
				const where = [addWhere(FIELD.key, what), addWhere('day', [Instant.WEEKDAY.All, now.dow], 'in')];

				sched = asAt(this.schedule, where, row.stamp)
					.reduce((near, itm) => Math.abs(this.asTime(itm.start) - hhmi) < Math.abs(this.asTime(near.start) - hhmi) ? itm : near, { start: '00:00' } as ISchedule);
				if (isEmpty(sched))
					throw new Error(`Cannot determine schedule: ${JSON.stringify(row)}`);
				if (row.note && row.note.includes('Bonus: Week Level reached'))
					row.elect = BONUS.week;
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
						const where: TWhere = [
							addWhere(FIELD.uid, this.current!.uid),
							addWhere('track.class', sched[FIELD.key]),
							addWhere('track.date', new Instant(row.stamp).format(Instant.FORMAT.yearMonthDay)),
						]
						this.data.getFire<IForum>(COLLECTION.forum, { where })
							.then(list => {
								if (!list.length)
									this.forum.setComment({ key: sched[FIELD.id], type: sched[FIELD.store], date: row.stamp, track: { class: caldr && caldr.name || sched[FIELD.key] }, comment })
								resolve(true);
							})
					}
					else resolve(false);
				}))
				.then(_ => p.resolve(flag))
		} else {
			p.resolve(flag)
			if (!rest.length)														// queue is empty
				this.check.resolve(true);									// mark 'check phase' complete
		}

		p.promise
			.then(_ => this.nextAttend(flag, rest[0], ...rest.slice(1)))
	}

	private asTime(hhmm: string) {
		return Number(hhmm.replace(':', ''));
	}

	private lookupMigrate(key: string | number, type: string = STORE.event) {
		return this.migrate
			.find(row => row[FIELD.key] === asString(key)) || {
				[FIELD.id]: this.data.newId,
				[FIELD.store]: STORE.migrate,
				[FIELD.type]: type as STORE.class | STORE.event,
				[FIELD.key]: asString(key),
				[FIELD.uid]: this.current!.uid,
				attend: {}
			} as IMigrate
	}

	private writeMigrate(migrate: IMigrate) {
		const where = addWhere(FIELD.uid, this.current!.uid);

		return this.data.setDoc(STORE.migrate, migrate)
			.then(_ => this.data.getStore<IMigrate>(STORE.migrate, where))
			.then(res => this.migrate = res);
	}

	private async lastAttend() {
		const [summary, profile, active, history] = await Promise.all([
			this.member.getAmount(),								// get closing balance
			this.member.getPlan(),									// get final Plan
			this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.uid)),
			this.history.promise,
		]);

		this.dbg('history: %j', history.reduce((prev: any, curr: any) => {
			if (curr.type === 'Debit')
				prev.paid += parseFloat(curr.credit)
			else prev.spend += parseFloat(curr.debit)
			return prev;
		}, { paid: 0, spend: 0 }))

		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const closed = active[0] && active[0].expiry;

		this.dbg('account: %j', summary);					// the current account summary
		active.orderBy('-' + FIELD.stamp);
		if (active[0][FIELD.type] === PAYMENT.debit && active[0].approve && !active[0][FIELD.expire]) {
			const test1 = active[0].expiry && active[0].expiry < getStamp();
			const test2 = summary.pend < 0;			// closed account
			const test3 = summary.funds < 0;
			if (test1 || test2 || test3) {
				const when = active[0].approve[FIELD.stamp];
				this.dbg('closed: %j, %s', when, fmtDate(Instant.FORMAT.display, when));
				updates.push({ ...active[0], [FIELD.effect]: active[0].stamp, [FIELD.expire]: when, bank: summary.adjust === summary.funds ? -summary.funds : summary.funds });
				updates.push({ ...active[1], [FIELD.expire]: active[0].stamp });
			}
		}

		if (active[0][FIELD.type] === PAYMENT.topUp && profile.plan === PLAN.gratis && active[0].expiry) {
			if (closed && closed < getStamp() && !active[0][FIELD.expire]) {
				this.dbg('closed: %j, %s', closed, fmtDate(Instant.FORMAT.display, closed));
				updates.push({ ...active[0], [FIELD.expire]: closed });
			}
		}

		this.data.batch(creates, updates, undefined, Member.Set)
			.then(_ => this.member.updAccount())
			.finally(() => this.dbg('done'))
	}

	async delPayment(full: boolean) {
		const where = addWhere(FIELD.uid, this.current!.uid);
		const [attends, payments, gifts] = await Promise.all([
			this.data.getStore<IAttend>(STORE.attend, where),
			this.data.getStore<IPayment>(STORE.payment, [where, addWhere(FIELD.store, STORE.payment)]),
			this.data.getStore<IGift>(STORE.gift, [where, addWhere(FIELD.store, STORE.gift)]),
		])
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = [...attends, ...payments, ...gifts];

		if (full)
			deletes.push(...await this.data.getStore<IMigrate>(STORE.migrate, [where, addWhere(FIELD.type, [STORE.event, STORE.class])]))

		return this.data.batch(creates, updates, deletes, Member.Set)
			.then(_ => this.member.updAccount())
			.finally(() => this.dbg('done'))
	}

	async revPayment() {
		this.dbg('revPayment:  not implemented');
		return;
	}

	async revAttend() {
		const dt = window.prompt('From which date');
		if (dt) {
			const now = getDate(dt);
			if (!now.isValid()) {
				window.alert(`'${dt}': Not a valid date`);
				return;
			}
			if (window.confirm(`${now.format(Instant.FORMAT.display)}: are you sure you want to delete from this date?`))
				this.attend.delAttend(addWhere('track.date', now.format(Instant.FORMAT.yearMonthDay), '>='));
		}
	}

	async delAttend() {											// no longer used... see AttendService.delAttend()
		const where = addWhere(FIELD.uid, this.current!.uid);
		const [deletes, [payments, gifts, profile, plans, prices, comments, hist = []]] = await Promise.all([
			this.data.getStore<IAttend>(STORE.attend, where),
			this.getMember(),
		])
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = payments
			.filter(row => row[FIELD.effect])		// only select those that are in-effect
			.map(row => ({											// reset the calculated-fields
				...row,
				[FIELD.effect]: firestore.FieldValue.delete(),
				[FIELD.expire]: firestore.FieldValue.delete(),
				bank: firestore.FieldValue.delete(),
				expiry: this.getExpiry({ stamp: row[FIELD.stamp], credit: row.amount && row.amount.toString(), debit: row.adjust && row.adjust.toString(), hold: row.hold, title: '', date: 0, type: 'topUp' } as MHistory,
					profile, plans, prices),
			}));

		updates.push(...gifts
			.filter(row => row[FIELD.expire])
			.map(row => ({
				...row,														// un-expire any Gifts
				[FIELD.expire]: firestore.FieldValue.delete(),
			}))
		);
		if (!deletes.length && !updates.length)
			this.dbg('attends: Nothing to do');

		await this.member.setAccount(creates, updates);
		return this.data.batch(creates, updates, deletes, Member.Set)
	}

	private async fetch(action: string, query: string) {
		const urlParams = `${SHEET_URL}?${query}&action=${action}&prefix=${SHEET_PREFIX}`;
		try {
			const res = await this.http
				.get(urlParams, { responseType: 'text' })
				.pipe(retry(2))
				.toPromise();
			const json = res.substring(0, res.length - 1).substring(SHEET_PREFIX.length + 1, res.length);
			this.dbg('fetch: %j', urlParams);
			try {
				const obj = JSON.parse(json);
				return (action === 'history,status')
					? { ...obj.status, ...obj.history }
					: obj[action];
			}
			catch (err) {
				this.dbg('not a valid JSON');
				return {};
			}
		}
		catch (err_1) {
			return this.dbg('cannot fetch: %s', err_1.message);
		}
	}

	private async migrateComment() {
		const uid = 'LucyC';
		const filter = [
			addWhere(FIELD.uid, uid),
			// addWhere(FIELD.note, '', '>'),
			addWhere('track.date', 20200127),
		]
		const list = await this.data.getFire<IAttend>(COLLECTION.attend, { where: filter });

		// const deletes = await this.data.getFire<IComment>(COLLECTION.forum, { where: addWhere(FIELD.uid, uid) });
		// await this.data.batch(undefined, undefined, deletes);

		this.dbg('list: %j', list.length);
		this.dbg('list: %j', list);
		list.forEach(async doc => {
			const { comment, note } = cleanNote(doc[FIELD.note]);
			this.dbg('note: <%s> => clean: <%s>', doc[FIELD.note], note);
			if (doc[FIELD.note] !== note) {
				this.dbg('comment: %j', comment);
				doc[FIELD.note] = note;																// replace with cleaned Note
				await Promise.all([
					this.data.updDoc(STORE.attend, doc[FIELD.id], doc),	// update Attend with cleaned Note
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
}
