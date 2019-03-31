import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { take, map, debounce, timeout } from 'rxjs/operators';
import { Actions, ofActionDispatched, Store } from '@ngxs/store';

import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/snack/snack.service';
import { MHistory } from '@route/migrate/attend/mig.interface';
import { DataService } from '@dbase/data/data.service';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment, TStoreBase, ISchedule, IEvent, ICalendar, IAttend, IClass, IMigrateBase } from '@dbase/data/data.schema';
import { asAt } from '@dbase/library/app.library';
import { AuthOther } from '@dbase/state/auth.action';
import { NewAttend } from '@dbase/state/state.action';
import { IAccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { DATE_FMT, getDate, getStamp } from '@lib/date.library';
import { sortKeys, IObject } from '@lib/object.library';
import { isUndefined } from '@lib/type.library';
import { asString } from '@lib/string.library';
import { deDup } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';

	private register$: Observable<IRegister[]>;
	private account$!: Observable<IAccountState>;
	private history!: Promise<MHistory[]>;
	private status!: { [key: string]: any };
	private migrate!: IMigrateBase[];
	private current: IRegister | null;
	private user!: firebase.UserInfo | null;

	private schedule!: ISchedule[];
	private calendar!: ICalendar[];
	private events!: IEvent[];
	private class!: IClass[];

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

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private snack: SnackService,
		private sync: SyncService, private service: MemberService, private store: Store, private actions: Actions) {
		this.current = null;
		this.register$ = this.state.getAdminData()
			.pipe(
				map(admin => admin[STORE.register]),								// get 'register' store
				map(reg => (reg || []).filter(row => row.migrate)),	// only return 'migrated' members
				map(reg => reg.sort(sortKeys('user.customClaims.memberName'))),
			)

		this.data.getFire<ISchedule>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.schedule) })
			.then(schedule => this.schedule = schedule);
		this.data.getFire<ICalendar>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.calendar) })
			.then(calendar => this.calendar = calendar);
		this.data.getFire<IEvent>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.event) })
			.then(events => this.events = events);
		this.data.getFire<IClass>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.class) })
			.then(klass => this.class = klass);

		this.state.getAuthData()																	// stash the current Auth'd user
			.pipe(take(1))
			.toPromise()
			.then(auth => this.user = auth.auth.user)
	}

	ngOnInit() { }

	async signIn(register: IRegister) {
		this.current = register;																	// stash current Member

		this.store.dispatch(new AuthOther(register.uid))
			.pipe(take(1))
			.subscribe(_other => {
				const query: IQuery = { where: addWhere(FIELD.uid, [this.user!.uid, register.user.uid]) };
				this.sync.on(COLLECTION.member, query);
				this.sync.on(COLLECTION.attend, query);

				this.data.getFire<IMigrateBase>(STORE.migrate, { where: [addWhere(FIELD.uid, this.current!.uid), addWhere(FIELD.type, STORE.event)] })
					.then(migrate => this.migrate = migrate)
					.then(res => this.dbg('migrate: %s', res.length))

				const action = 'history,status';
				const { id, provider } = register.migrate!.providers[0];
				this.history = this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: MHistory[], status: {} }) => {
						this.status = resp.status;
						return (resp.history || []).sort(sortKeys(FIELD.stamp));
					})
				this.history
					.then(hist => this.dbg('history: %s, %j', hist.length, this.status))
					.catch(err => this.dbg('err: %j', err.message))

				this.account$ = this.state.getAccountData()
			});
	}

	async	signOut() {																					// signOut of 'impersonate' mode
		this.store.dispatch(new AuthOther(this.user!.uid))
			.pipe(take(1))
			.subscribe(_other => {
				const query: IQuery = { where: addWhere(FIELD.uid, this.user!.uid) };

				this.current = null;
				this.sync.on(COLLECTION.member, query);
				this.sync.on(COLLECTION.attend, query);							// restore Auth User's state
			})
	}

	async addPayment() {
		const hist = (await this.history) || [];
		const creates = hist
			.filter(row => row.type === 'Debit' || row.type === 'Credit')
			.map(row => {
				const approve: { stamp: number; uid: string; } = { stamp: 0, uid: '' };
				const payType = row.type !== 'Debit' || (row.note && row.note.startsWith('Write-off')) ? 'debit' : 'topUp';

				if (row.title.startsWith('Approved: ')) {
					approve.stamp = row.approved!;
					approve.uid = 'JorgeEC';
				}

				this.dbg('row: %j', row);
				const paym = {
					[FIELD.id]: this.data.newId,
					[FIELD.store]: STORE.payment,
					[FIELD.type]: payType,
					[FIELD.uid]: this.current!.uid,
					stamp: row.stamp,
					amount: parseFloat(row.credit!),
				} as IPayment

				if (row.note)
					paym.note = row.note;
				if (approve.stamp)
					paym.approve = approve;

				return paym;
			});

		this.data.batch(creates)
			.then(_ => this.dbg('payment: %s', creates.length))
	}

	// TODO: if a colour is wrong at source, might have been Event.
	// TODO: if Event*1, then is it zumba? step? etc?
	/**
	 * Add Attendance records for a Member
	 */
	async addAttend() {
		const table = (await this.history)								// a sorted-list of Attendance check-ins / account payments
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
		// .slice(0, 10)																		// for testing: just the first few Attends
		this.newAttend(table[0], ...table.slice(1));
	}

	newAttend(row: MHistory, ...rest: MHistory[]) {
		this.dbg('hist: %j', row);
		const what = this.lookup[row.type] || row.type;
		const dow = getDate(row.date).dow;
		const where = [
			addWhere(FIELD.key, what),
			addWhere('day', dow),
		]

		const caldr = asAt(this.calendar, addWhere(FIELD.key, row.date), row.date)[0];
		const [prefix, suffix, ...none] = what.split('*');
		let sched: ISchedule;
		let event: IEvent;
		let idx: number = 0;

		switch (true) {
			case this.special.includes(prefix):						// special event match by <type>, so we need to guess the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				const cnt = suffix ? parseInt(suffix.split(' ')[0], 10) : 1;
				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
				const migrate = asAt(this.migrate, [addWhere(FIELD.key, caldr[FIELD.key]), addWhere('order', cnt)])[0];
				if (!migrate) {
					for (idx = 0; idx < event.classes.length; idx++) {
						if (window.prompt(`This class on ${getDate(caldr.key).format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
							break;
					}
					if (idx === event.classes.length)
						throw new Error('Cannot determine class');
					this.data.setDoc(STORE.migrate, {
						[FIELD.id]: this.data.newId, [FIELD.store]: STORE.migrate, order: asString(cnt),
						[FIELD.type]: STORE.event, [FIELD.key]: asString(caldr[FIELD.key]), [FIELD.uid]: this.current!.uid, class: event.classes[idx]
					});
				}

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: (migrate && migrate.class) || event.classes[idx],
					day: getDate(caldr.key).ww, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: caldr.name,
				}

				for (let nbr = 1; nbr < cnt; nbr++) {				// stack additional attends
					row.type = prefix + '*-' + nbr;						// TODO: determine if ZumbaStep via the row.amount?  startTime
					rest.splice(0, 0, row);
					this.dbg('splice: %j', rest);
				}
				break;

			case (!isUndefined(caldr)):										// special event match by <date>, so we already know the 'class'
				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];

				for (idx = 0; idx < event.classes.length; idx++) {
					if (window.prompt(`This class on ${getDate(caldr.key).format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
						break;
				}
				if (idx === event.classes.length)
					throw new Error('Cannot determine class');

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: event.classes[idx],
					day: getDate(caldr.key).ww, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: caldr.name,
				}
				break;

			default:
				sched = asAt(this.schedule, where, row.date)[0];
				if (!sched)
					throw new Error(`Cannot determine schedule: ${JSON.stringify(where)}`);
		}

		const sub = this.actions.pipe(
			ofActionDispatched(NewAttend),							// we have to wait for FireStore to sync with NGXS, so we get latest account-details
			debounce(_ => timer(500)),									// wait to have State settle
			timeout(5000),															// throw an Error if no sync after five-seconds
		)																							// wait for new Attend to sync into State
			.subscribe(row => {
				this.dbg('sync: %j', row);
				sub.unsubscribe();
				if (rest.length)
					this.newAttend(rest[0], ...rest.slice(1))
				else {
					// if (this.status.creditExpires) {
					// const closed = getDate(this.status.creditExpires.split('>')[1]).ts;
					this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.uid))
						.then(active => {
							active.sort(sortKeys('-' + FIELD.stamp));
							const closed = active[0].expiry;
							if (closed && closed < getStamp() && !active[0][FIELD.expire]) {
								this.dbg('closed: %j, %s', closed, getDate(closed).format(DATE_FMT.display));
								this.dbg('active: %j', active[0]);
								this.data.updDoc(STORE.payment, active[0][FIELD.id], { [FIELD.expire]: closed, ...active[0] })
							}
						})
					// }
				}
			},
				(err => { throw new Error('timeout: ' + err.message) })
			)
		return this.service.setAttend(sched, row.note, row.stamp);
	}

	async delPayment() {
		const where = [
			addWhere(FIELD.store, STORE.payment),
			addWhere(FIELD.uid, this.current!.user.uid),
		]
		const deletes = await this.data.getFire<TStoreBase>(COLLECTION.member, { where });

		where.length = 0;													// truncate where-clause
		where.push(addWhere(FIELD.uid, this.current!.user.uid));
		deletes.push(...await this.data.getFire<TStoreBase>(COLLECTION.attend, { where }));

		return this.data.batch(undefined, undefined, deletes)
	}

	async delAttend() {
		const deletes = await this.data.getFire<IAttend>(COLLECTION.attend, { where: addWhere(FIELD.uid, this.current!.user.uid) });
		const pays = deDup(...deletes.map(row => row.payment));
		const payments = await this.data.getStore<IPayment>(STORE.payment, [
			addWhere(FIELD.uid, this.current!.user.uid),
			addWhere(FIELD.id, pays),											// get any Payment which is referenced by the Attend documents
		])
		const updates = payments.map(row => ({
			...row, [FIELD.effect]: Number.MIN_SAFE_INTEGER, [FIELD.expire]: Number.MIN_SAFE_INTEGER,
			bank: Number.MIN_SAFE_INTEGER, expiry: Number.MIN_SAFE_INTEGER
		})
		);

		this.dbg('payments: %j', payments);
		this.dbg('updates: %j', updates);
		return this.data.batch(undefined, updates, deletes);
	}

	private async fetch(action: string, query: string) {
		const urlParams = `${this.url}?${query}&action=${action}&prefix=${this.prefix}`;
		const res = await this.http
			.get(urlParams, { responseType: 'text' })
			.toPromise()
		const json = res.substring(0, res.length - 1).substring(this.prefix.length + 1, res.length);

		this.dbg('fetch: %j', urlParams);
		try {
			const obj = JSON.parse(json);
			return (action === 'history,status')
				? Object.assign({}, { history: obj.history.history }, { status: obj.status.status })
				: obj[action];
		} catch (err) {
			this.dbg('not a valid JSON');
			return {}
		}
	}
}
