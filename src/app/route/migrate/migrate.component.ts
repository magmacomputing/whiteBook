import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map, retry } from 'rxjs/operators';
import { firestore } from 'firebase/app';
import { Store } from '@ngxs/store';

import { AdminService } from '@service/admin/admin.service';
import { MemberService } from '@service/member/member.service';
import { AttendService } from '@service/member/attend.service';
import { getProviderId } from '@service/auth/auth.library';
import { MHistory } from '@route/migrate/migrate.interface';
import { DataService } from '@dbase/data/data.service';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment, ISchedule, IEvent, ICalendar, IAttend, IMigrateBase, IStoreMeta, TClass, IGift, IPlan, IPrice, IProfilePlan, IBonus } from '@dbase/data/data.schema';
import { asAt } from '@library/app.library';
import { AuthOther } from '@dbase/state/auth.action';
import { IAccountState, IAdminState } from '@dbase/state/state.define';
import { SetMember } from '@dbase/state/state.action';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery, TWhere } from '@dbase/fire/fire.interface';

import { DATE_FMT, getDate, getStamp, fmtDate } from '@lib/date.library';
import { sortKeys, IObject, cloneObj, getPath } from '@lib/object.library';
import { isUndefined, isNull, getType, TString } from '@lib/type.library';
import { asString, asNumber } from '@lib/string.library';
import { asArray } from '@lib/array.library';
import { IPromise, createPromise } from '@lib/utility.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-migrate',
	templateUrl: './migrate.component.html',
})
export class MigrateComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';
	public hidden = false;
	public creditIdx = 0;
	public credit = ['value', 'zero', 'all'];

	public dash$!: Observable<IAdminState["dash"]>;
	private account$!: Observable<IAccountState>;
	private history: IPromise<MHistory[]>;
	private status!: { [key: string]: any };
	private migrate!: IMigrateBase[];
	private current: IRegister | null = null;
	private user!: firebase.UserInfo | null;
	private dflt!: string;
	private ready!: Promise<boolean[]>;
	private check!: IPromise<boolean>;
	public hide = 'Un';

	private schedule!: ISchedule[];
	private calendar!: ICalendar[];
	private events!: IEvent[];

	private lookup: IObject<string> = {
		oldStep: 'MultiStep',
		Step: 'MultiStep',
		oldStepDown: 'StepDown',
		oldAeroStep: 'AeroStep',
		oldHiLo: 'HiLo',
		oldZumba: 'Zumba',
		oldZumbaStep: 'ZumbaStep',
		oldSmartStep: 'SmartStep',
		prevStep: 'MultiStep',
		prevSmartStep: 'SmartStep',
		prevStepDown: 'StepDown',
		prevAeroStep: 'AeroStep',
		prevHiLo: 'HiLo',
		prevZumba: 'Zumba',
		prevZumbaStep: 'ZumbaStep',
		prevStepIn: 'StepIn',
	}
	private special = ['oldEvent', 'Spooky', 'Event', 'Zombie', 'Special', 'Xmas', 'Creepy', 'Holiday', 'Routine'];
	private pack = ['oldSunday3Pak', 'oldSunday3For2', 'Sunday3For2'];

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private change: ChangeDetectorRef,
		private sync: SyncService, private member: MemberService, private store: Store, private attend: AttendService, private admin: AdminService) {

		this.history = createPromise<MHistory[]>();
		this.filter();

		this.data.getFire<ISchedule>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.schedule) })
			.then(schedule => this.schedule = schedule);
		this.data.getFire<ICalendar>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.calendar) })
			.then(calendar => this.calendar = calendar);
		this.data.getFire<IEvent>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.event) })
			.then(events => this.events = events);

		this.state.getAuthData()																	// stash the Auth'd user
			.pipe(take(1))
			.toPromise()
			.then(auth => this.user = auth.auth.user)

		// const updates: IStoreMeta[] = [];
		// const deletes: IStoreMeta[] = [];
		// // this.data.getStore<IProfileClaim>(STORE.profile, addWhere(FIELD.type, 'claim'))
		// this.data.getFire<IProfileClaim>(COLLECTION.member, {
		// 	where: [
		// 		addWhere(FIELD.store, STORE.profile),
		// 		addWhere(FIELD.type, 'claim'),
		// 	]
		// })
		// 	.then(profiles => {
		// 		this.dbg('profiles: %j, %j', profiles.length, profiles.map(profile => profile[FIELD.id]));
		// 		profiles.forEach(profile => {
		// 			if (profile[FIELD.expire]) {
		// 				profile[FIELD.expire] = firestore.FieldValue.delete();
		// 				updates.push({ ...profile });
		// 			}
		// 		})
		// 	})
		// 	.then(_ => this.data.batch(undefined, updates, deletes))
	}

	ngOnInit() { }

	async delUser() {
		const where: TWhere = [addWhere(FIELD.uid, this.current!.uid)];
		const deletes = await Promise.all([
			this.data.getFire<IStoreMeta>(COLLECTION.member, { where }),
			this.data.getFire<IStoreMeta>(COLLECTION.admin, { where }),
			this.data.getFire<IStoreMeta>(COLLECTION.attend, { where }),
		]);

		return this.data.batch(undefined, undefined, deletes.flat());
	}

	public filter(key?: string) {
		this.dash$ = this.state.getAdminData().pipe(
			map(data => data.dash
				.filter(row => row.register.migrate)
				.filter(row => !!row.register[FIELD.hidden] === this.hidden)
				.filter(row => {
					switch (this.credit[this.creditIdx]) {
						case 'all':
							return true;
						case 'value':
							return getPath(row.account, 'summary.credit');
						case 'zero':
							return !getPath(row.account, 'summary.credit');
					}
				})
			))

		switch (key) {
			case 'hide':
				this.hidden = !this.hidden;
				break;
			case 'credit':
				this.creditIdx += 1;
				if (!this.credit[this.creditIdx])
					this.creditIdx = 0;
				break;
		}
	}

	async signIn(register: IRegister) {
		if (this.current && this.current!.user.customClaims!.alias === register.user.customClaims!.alias)
			return this.signOut();																// <click> on picture will signIn / signOut
		this.current = register;																// stash current Member

		this.store.dispatch(new AuthOther(register.uid))
			.pipe(take(1))
			.subscribe(async _other => {
				const query: IQuery = { where: addWhere(FIELD.uid, [this.user!.uid, register.user.uid]) };
				await Promise.all([																	// initial sync complete
					this.sync.on(COLLECTION.member, query),
					this.sync.on(COLLECTION.attend, query),
				]);

				const action = 'history,status';
				const { id, provider } = register.migrate!.providers[0];
				this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: MHistory[], status: {} }) => {
						this.status = resp.status;
						return (resp.history || []).sort(sortKeys(FIELD.stamp));
					})
					.then(history => this.history.resolve(history))
				this.history.promise
					.then(hist => this.dbg('history: %s, %j', hist.length, this.status))
					.catch(err => this.dbg('err: %j', err.message))

				this.account$ = this.state.getAccountData();
				this.dflt = 'Zumba';
				this.hide = register[FIELD.hidden]
					? 'Un'
					: ''
				this.change.detectChanges();
			});
	}

	async	signOut() {																					// signOut of 'on-behalf' mode
		this.current = null;
		this.history = createPromise<MHistory[]>();
		this.hide = '';

		this.store.dispatch(new AuthOther(this.user!.uid))
			.pipe(take(1))
			.subscribe(_other => {
				const query: IQuery = { where: addWhere(FIELD.uid, this.user!.uid) };

				this.sync.on(COLLECTION.member, query);
				this.sync.on(COLLECTION.attend, query);							// restore Auth User's state
			})
	}

	async hideUser() {
		const reg = (await this.data.getStore<IRegister>(STORE.register, addWhere(FIELD.uid, this.current!.uid)))[0];
		reg[FIELD.hidden] = reg[FIELD.hidden]
			? firestore.FieldValue.delete()
			: true;
		this.hide = reg[FIELD.hidden]
			? 'Un'
			: ''
		this.data.updDoc(STORE.register, reg[FIELD.id], { ...reg });
	}

	async setAccount() {
		const creates: IStoreMeta[] = [],
			updates: IStoreMeta[] = [];
		await this.member.setAccount(creates, updates);

		this.data.batch(creates, updates);
	}

	async setProfile() {
		const reg = (await this.data.getStore<IRegister>(STORE.register, addWhere(FIELD.uid, this.current!.uid)))[0];
		const providers = reg.migrate!.providers || [];

		Promise.all(providers
			.filter(provider => !isNull(provider))
			.map(provider => {
				const profile: firebase.auth.AdditionalUserInfo = {
					isNewUser: false,
					providerId: getProviderId(provider!.provider),
					profile: provider,
				}
				return this.member.getAuthProfile(profile, this.current!.uid);
			})
		)
	}

	/** get the data needed to migrate a Member */
	private async getMember() {
		return Promise.all([
			this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IGift>(STORE.gift, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IProfilePlan>(STORE.profile, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IPlan>(STORE.plan),
			this.data.getStore<IPrice>(STORE.price),
			this.history.promise,
		])
	}

	async addPayment() {
		const [payments, gifts, profile, plans, prices, hist = []] = await this.getMember();
		const creates: IStoreMeta[] = hist
			.filter(row => (row.type === 'Debit' && !(row.note && row.note.toUpperCase().startsWith('Auto-Approve Credit '.toUpperCase())) || row.type === 'Credit'))
			.filter(row => isUndefined(payments.find(pay => pay[FIELD.stamp] === row[FIELD.stamp])))
			.map(row => {
				const approve: { stamp: number; uid: string; } = { stamp: 0, uid: '' };
				const payType = row.type !== 'Debit' || (row.note && row.note.toUpperCase().startsWith('Write-off'.toUpperCase())) ? 'debit' : 'topUp';

				if (row.title.toUpperCase().startsWith('Approved: '.toUpperCase())) {
					approve.stamp = row.approved!;
					approve.uid = 'JorgeEC';
				}

				if (payType === 'topUp') {
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
					amount: payType === 'topUp' ? parseFloat(row.credit!) : undefined,
					adjust: row.debit && parseFloat(row.debit),
					approve: approve.stamp && approve,
					expiry: this.getExpiry(row, profile, plans, prices),
					note: row.note,
				} as IPayment
			});

		let giftCnt = 0;
		let start = 0;
		let rest: string | undefined = undefined;
		hist
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.filter(row => row.note && row.debit && parseFloat(row.debit) === 0 && row.note.includes('Gift #'))
			.forEach(row => {
				const search = (row.note && row.note.search('Gift #') + 6) || 0;
				const match = search && row.note!.substring(search).match(/\d+/g);
				if (match) {
					const nbr = parseInt(match[0]);
					if (nbr === 1) {
						if (giftCnt && start && !gifts.find(row => row[FIELD.stamp] === start)) {
							creates.push(this.setGift(giftCnt, start, rest));
						}
						giftCnt = 0;
						rest = row.note!
							.substring(search + match[0].length)
							// .replace(/[^\x20-\x7E]/g, '')
							.trim();
						if (rest && rest.startsWith(':'))
							rest = rest.substring(1).trim();
						start = row.stamp;
					}
					if (nbr > giftCnt)
						giftCnt = nbr;
				}
			})

		if (giftCnt && !gifts.find(row => row[FIELD.stamp] === start))
			creates.push(this.setGift(giftCnt, start, rest));

		this.data.batch(creates, undefined, undefined, SetMember)
			.then(_ => this.member.updAccount())
			.then(_ => this.dbg('payment: %s', creates.length))
	}

	/** Watch Out !   This routine is a copy from the MemberService.calcExpiry() */
	private getExpiry(row: MHistory, profile: IProfilePlan[], plans: IPlan[], prices: IPrice[]) {
		let expiry: number | undefined = undefined;
		const plan = asAt(profile, addWhere(FIELD.type, 'plan'), row.stamp)[0];
		const desc = asAt(plans, addWhere(FIELD.key, plan.plan), row.stamp)[0];
		const curr = asAt(prices, addWhere(FIELD.key, plan.plan), row.stamp);
		const topUp = curr.find(row => row[FIELD.type] === 'topUp' && row[FIELD.key] === plan.plan);
		const paid = parseFloat(row.credit || '0') + parseFloat(row.debit || '0');

		if (topUp && !isUndefined(desc.expiry)) {
			const offset = topUp.amount
				? Math.round(paid / (topUp.amount / desc.expiry)) || 1
				: desc.expiry;
			expiry = getDate(row.approved || row.stamp).add(offset, 'months').add(row.hold || 0, 'days').startOf('day').ts;
			if (row.debit && parseFloat(row.debit) < 0) expiry = undefined;
		}

		return expiry;
	}

	private setGift(gift: number, start: number, note?: string) {
		let offset = getDate(start).startOf('day').ts;
		if (note && note.includes('start: ')) {
			debugger;																					// TODO: only for one Member
			let time = note.substring(note.indexOf('start: ') + 6).match(/\d\d:\d\d+/g);
			if (!isNull(time))
				offset = getDate(start).startOf('day').add(asNumber(time[0]), 'hours').add(asNumber(time[1]), 'minutes').ts;
		}
		return {
			[FIELD.effect]: offset,
			[FIELD.store]: STORE.gift,
			stamp: start,
			count: gift,
			note: note || undefined,
		} as IGift
	}

	/** Add Attendance records for a Member */
	public async addAttend() {
		const [migrate, attend, history] = await Promise.all([
			this.data.getStore<IMigrateBase>(STORE.migrate, addWhere(FIELD.uid, this.current!.uid)),
			this.data.getStore<IAttend>(STORE.attend, addWhere(FIELD.uid, this.current!.uid)),
			this.history.promise,
		])

		this.migrate = migrate;
		const table = history.filter(row => row.type !== 'Debit' && row.type !== 'Credit');
		const start = attend.sort(sortKeys('-track.date'));
		const preprocess = cloneObj(table);

		// const endAt = table.filter(row => row.date >= getDate('2013-Nov-16').format(DATE_FMT.yearMonthDay)).length;
		// table.splice(table.length - endAt);

		if (start[0]) {																	// this is not fool-proof.   SpecialEvent, 3Pack
			const startFrom = start[0].track.date;
			const startAttend = start.filter(row => row.track.date === startFrom).map(row => row.timetable[FIELD.key]);
			this.dbg('startFrom: %s, %j', startFrom, startAttend);
			const offset = table.filter(row => row.date < startFrom || (row.date === startFrom && startAttend.includes((this.lookup[row.type] || row.type) as TClass))).length;
			table.splice(0, offset);
		}
		if (table.length) {
			this.check = createPromise();
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

		let what = this.lookup[row.type] || row.type;
		const now = getDate(row.date);

		let price = parseInt(row.debit || '0') * -1;				// the price that was charged
		const caldr = asAt(this.calendar, [addWhere(FIELD.key, row.date), addWhere('location', 'norths', '!=')], row.date)[0];
		const calDate = caldr && getDate(caldr[FIELD.key]);
		const [prefix, suffix] = what.split('*');
		let sfx = suffix ? suffix.split(' ')[0] : '1';
		let sched: ISchedule;
		let event: IEvent;
		let idx: number = 0;
		let migrate: IMigrateBase | undefined;

		if (this.special.includes(prefix) && suffix && parseInt(sfx).toString() === sfx && !sfx.startsWith('-')) {
			if (flag) this.dbg(`${prefix}: need to resolve ${sfx} classes`);
			for (let nbr = parseInt(sfx); nbr > 1; nbr--) {			// insert additional attends
				row.type = prefix + `*-${nbr}.${sfx}`;
				rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + nbr - 1 });
				if (flag) this.dbg('splice: %j', row.type);
			}
			sfx = `-1.${sfx}`;
		}

		if (this.pack.includes(prefix)) {
			const [plan, prices, bonus] = await Promise.all([
				this.data.getStore<IProfilePlan>(STORE.profile, addWhere(FIELD.type, 'plan'), now),
				this.data.getStore<IPrice>(STORE.price, undefined, now),
				this.data.getStore<IBonus>(STORE.bonus, undefined, now),
			])
			const obj = prices
				.filter(row => row[FIELD.key] === plan[0].plan)
				.reduce((accum, row) => {
					accum[row[FIELD.type]] = row;
					return accum;
				}, {} as IObject<IPrice>)
			const sunday = bonus.find(row => row[FIELD.key] === 'sunday');
			if (isUndefined(sunday))
				throw new Error(`Cannot find a Sunday bonus: ${now.format('yyyymmdd')}`);
			const free = asArray(sunday.free as TString)

			if (row.note && (row.note.includes('Bonus: Week Level reached'))) {
				obj.full.amount = 0;
				price = 0;
				row.elect = 'week';													// Week bonus takes precedence
			} else if (row.note && row.note.includes('Gift #')) {
				obj.full.amount = 0;
				price = 0;
				row.elect = 'gift';													// special: accidental one-gift claimed against three classes
			} else {
				price -= obj.full.amount + 0;								// calc the remaining price, after deduct MultiStep
				row.elect = 'sunday';												// dont 'elect' to skip Gifts on a Pack
			}
			rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + 2, [FIELD.type]: 'Zumba', debit: '-' + (free.includes('Zumba') ? 0 : Math.abs(price)).toString() });
			rest.splice(0, 0, { ...row, [FIELD.stamp]: row.stamp + 1, [FIELD.type]: 'ZumbaStep', debit: '-' + (free.includes('ZumbaStep') ? 0 : Math.abs(price)).toString() });
			what = 'MultiStep';
			price = obj.full.amount;											// set this row's price to MultiSTep
		}

		switch (true) {
			case this.special.includes(prefix):						// special event match by <colour>, so we need to prompt for the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
				migrate = this.lookupMigrate(caldr[FIELD.key]);

				if (!migrate.attend[sfx]) {
					for (idx = 0; idx < event.classes.length; idx++) {
						if (window.prompt(`This ${sfx} class on ${calDate.format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
							break;
					}
					if (idx === event.classes.length)
						throw new Error('Cannot determine event');

					migrate.attend[sfx] = event.classes[idx];
					await this.writeMigrate(migrate);
				}

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: migrate.attend[sfx],
					day: calDate.dow, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: caldr.name,
				}
				break;

			case (!isUndefined(caldr) && !row.elect):										// special event match by <date>, so we already know the 'class'
				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
				if (what === 'MultiStep' && !event.classes.includes(what))
					what = 'SingleStep';
				if (!event.classes.includes(what as TClass)) {
					migrate = this.lookupMigrate(caldr[FIELD.key]);
					if (!migrate.attend[what]) {
						for (idx = 0; idx < event.classes.length; idx++) {
							if (window.prompt(`This ${what} event on ${calDate.format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
								break;
						}
						if (idx === event.classes.length)
							throw new Error('Cannot determine event');

						migrate.attend[what] = event.classes[idx];
						await this.writeMigrate(migrate);
					}
					what = migrate.attend[what];
				}

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: what,
					day: getDate(caldr[FIELD.key]).dow, start: '00:00', location: caldr.location, instructor: caldr.instructor,
					note: row.note ? [row.note, caldr.name] : caldr.name, price,
				}
				break;

			case prefix === 'unknown':										// no color on the cell, so guess the 'class'
				migrate = this.lookupMigrate(now.format(DATE_FMT.yearMonthDay));
				let klass = migrate.attend.class || null;

				if (isNull(klass)) {
					klass = window.prompt(`This ${prefix} class on ${now.format(DATE_FMT.display)}?`, this.dflt);
					if (isNull(klass))
						throw new Error('Cannot determine class');
					this.dflt = klass;

					migrate.attend = { class: klass };
					await this.writeMigrate(migrate);
				}

				sched = asAt(this.schedule, addWhere(FIELD.key, klass), row.date)[0];
				if (!sched)
					throw new Error(`Cannot determine schedule: ${klass}`);
				sched.price = price;											// to allow AttendService to check what was charged
				break;

			default:
				const where = [addWhere(FIELD.key, what), addWhere('day', now.dow)];
				sched = asAt(this.schedule, where, row.date)[0];
				if (!sched)
					throw new Error(`Cannot determine schedule: ${JSON.stringify(row)}`);
				if (row.note && row.note.includes('Bonus: Week Level reached'))
					row.elect = 'week';
				sched.price = price;											// to allow AttendService to check what was charged
				sched.elect = row.elect;
		}

		const p = createPromise<boolean>();
		if (flag) {
			if (row.note && row.note.includes('elect false'))
				sched.elect = row.note;										// Member elected to not receive a Bonus
			this.attend.setAttend(sched, row.note, row.stamp)
				.then(res => {
					if (getType(res) === 'Boolean' && res === false)
						throw new Error('stopping');
					p.resolve(flag);
				})
		} else {
			p.resolve(flag)
			if (!rest.length)
				this.check.resolve(true);
		}

		p.promise
			.then(_ => this.nextAttend(flag, rest[0], ...rest.slice(1)))
	}

	private lookupMigrate(key: string | number, type: string = 'event') {
		return this.migrate
			.find(row => row[FIELD.key] === asString(key)) || {
				[FIELD.id]: this.data.newId,
				[FIELD.store]: STORE.migrate,
				[FIELD.type]: type as STORE.class | STORE.event,
				[FIELD.key]: asString(key),
				[FIELD.uid]: this.current!.uid,
				attend: {}
			} as IMigrateBase
	}

	private writeMigrate(migrate: IMigrateBase) {
		const where = addWhere(FIELD.uid, this.current!.uid);

		return this.data.setDoc(STORE.migrate, migrate)
			.then(_ => this.data.getStore<IMigrateBase>(STORE.migrate, where))
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
		active.sort(sortKeys('-' + FIELD.stamp));
		if (active[0][FIELD.type] === 'debit' && active[0].approve && !active[0][FIELD.expire]) {
			const test1 = active[0].expiry && active[0].expiry < getStamp();
			const test2 = summary.pend < 0;			// closed account
			const test3 = summary.funds < 0;
			if (test1 || test2 || test3) {
				const when = active[0].approve[FIELD.stamp];
				this.dbg('closed: %j, %s', when, fmtDate(DATE_FMT.display, when));
				updates.push({ ...active[0], [FIELD.effect]: active[0].stamp, [FIELD.expire]: when, bank: summary.adjust === summary.funds ? -summary.funds : summary.funds });
				updates.push({ ...active[1], [FIELD.expire]: active[0].stamp });
			}
		}

		if (active[0][FIELD.type] === 'topUp' && profile.plan === 'gratis' && active[0].expiry) {
			if (closed && closed < getStamp() && !active[0][FIELD.expire]) {
				this.dbg('closed: %j, %s', closed, fmtDate(DATE_FMT.display, closed));
				updates.push({ ...active[0], [FIELD.expire]: closed });
			}
		}

		this.data.batch(creates, updates, undefined, SetMember)
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
			deletes.push(...await this.data.getStore<IMigrateBase>(STORE.migrate, [where, addWhere(FIELD.type, [STORE.event, STORE.class])]))

		await this.member.setAccount(creates, updates);
		return this.data.batch(creates, updates, deletes)
	}

	async delAttend() {
		const where = addWhere(FIELD.uid, this.current!.uid);
		const [attends, [payments, gifts, profile, plans, prices, hist = []]] = await Promise.all([
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
		if (!attends.length && !updates.length)
			this.dbg('attends: Nothing to do');

		await this.member.setAccount(creates, updates);
		return this.data.batch(creates, updates, attends, SetMember)
	}

	private async fetch(action: string, query: string) {
		const urlParams = `${this.url}?${query}&action=${action}&prefix=${this.prefix}`;
		try {
			const res = await this.http
				.get(urlParams, { responseType: 'text' })
				.pipe(retry(2))
				.toPromise();
			const json = res.substring(0, res.length - 1).substring(this.prefix.length + 1, res.length);
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
}
