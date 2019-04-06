import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { Store } from '@ngxs/store';

import { MemberService } from '@service/member/member.service';
import { AttendService } from '@service/member/attend.service';
import { MHistory } from '@route/migrate/attend/mig.interface';
import { DataService } from '@dbase/data/data.service';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment, ISchedule, IEvent, ICalendar, IAttend, IClass, IMigrateBase, TStoreBase, IStoreMeta } from '@dbase/data/data.schema';
import { asAt } from '@dbase/library/app.library';
import { AuthOther } from '@dbase/state/auth.action';
import { IAccountState, IAdminState } from '@dbase/state/state.define';
import { SetMember } from '@dbase/state/state.action';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { DATE_FMT, getDate, getStamp, fmtDate } from '@lib/date.library';
import { sortKeys, IObject } from '@lib/object.library';
import { isUndefined, isNumber } from '@lib/type.library';
import { asString } from '@lib/string.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';
	public hidden = false;

	private account$!: Observable<IAccountState>;
	private dash$: Observable<IAdminState["admin"]["dashBoard"]>;
	private history!: Promise<MHistory[]>;
	private status!: { [key: string]: any };
	private migrate!: IMigrateBase[];
	private current: IRegister | null;
	private user!: firebase.UserInfo | null;

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

	constructor(private http: HttpClient, private data: DataService, private state: StateService,
		private sync: SyncService, private service: MemberService, private store: Store, private attend: AttendService) {
		this.current = null;

		this.toggleHide();

		this.data.getFire<ISchedule>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.schedule) })
			.then(schedule => this.schedule = schedule);
		this.data.getFire<ICalendar>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.calendar) })
			.then(calendar => this.calendar = calendar);
		this.data.getFire<IEvent>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.event) })
			.then(events => this.events = events);

		this.state.getAuthData()																	// stash the current Auth'd user
			.pipe(take(1))
			.toPromise()
			.then(auth => this.user = auth.auth.user)
	}

	ngOnInit() { }

	toggleHide() {
		this.dash$ = this.state.getAdminData().pipe(
			map(data => data.admin.dashBoard!
				.filter(row => row.register.migrate)
				.filter(row => !!row.register[FIELD.hidden] === this.hidden)
			),
		)
		this.hidden = !this.hidden;
	}

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
					hold: row.hold,
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
			.then(_ => this.attend.getAmount())							// re-calc Account summary
			.then(summary => this.data.writeAccount(summary))
	}

	/**
	 * Add Attendance records for a Member
	 */
	addAttend() {
		this.history																			// a sorted-list of Attendance check-ins / account payments
			.then(history => {
				const table = history.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
				this.nextAttend(table[0], ...table.slice(1));	// fire initial Attendance
			})
	}

	nextAttend(row: MHistory, ...rest: MHistory[]) {
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
		let migrate: IMigrateBase;

		switch (true) {
			case this.special.includes(prefix):						// special event match by <type>, so we need to guess the 'class'
				if (!caldr)
					throw new Error(`Cannot determine calendar: ${row.date}`);

				const sfx = suffix ? suffix.split(' ')[0] : '1';
				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
				migrate = asAt(this.migrate, [addWhere(FIELD.key, caldr[FIELD.key]), addWhere('order', sfx)])[0];
				if (!migrate) {
					for (idx = 0; idx < event.classes.length; idx++) {
						if (window.prompt(`This ${sfx} class on ${getDate(caldr.key).format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
							break;
					}
					if (idx === event.classes.length)
						throw new Error('Cannot determine class');

					this.data.setDoc(STORE.migrate, {
						[FIELD.id]: this.data.newId, [FIELD.store]: STORE.migrate, order: asString(sfx),
						[FIELD.type]: STORE.event, [FIELD.key]: asString(caldr[FIELD.key]), [FIELD.uid]: this.current!.uid, class: event.classes[idx]
					});
				}

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: (migrate && migrate.class) || event.classes[idx],
					day: getDate(caldr.key).ww, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: caldr.name,
				}

				if (isNumber(sfx)) {
					for (let nbr = 1; nbr < sfx; nbr++) {				// insert additional attends
						row.type = prefix + '*-' + nbr;						// TODO: determine if ZumbaStep via the row.amount?  startTime
						rest.splice(0, 0, row);
						this.dbg('splice: %j', rest);
					}
				}
				break;

			case (!isUndefined(caldr)):										// special event match by <date>, so we already know the 'class'
				event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
				migrate = asAt(this.migrate, [addWhere(FIELD.key, caldr[FIELD.key]), addWhere('order', event.name)])[0];
				if (!migrate) {
					for (idx = 0; idx < event.classes.length; idx++) {
						if (window.prompt(`This class on ${getDate(caldr.key).format(DATE_FMT.display)}, ${caldr.name}?`, event.classes[idx]) === event.classes[idx])
							break;
					}
					if (idx === event.classes.length)
						throw new Error('Cannot determine class');
					this.data.setDoc(STORE.migrate, {
						[FIELD.id]: this.data.newId, [FIELD.store]: STORE.migrate, order: event.name,
						[FIELD.type]: STORE.event, [FIELD.key]: asString(caldr[FIELD.key]), [FIELD.uid]: this.current!.uid, class: event.classes[idx]
					});
				}

				sched = {
					[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: event.classes[idx],
					day: getDate(caldr.key).dow, start: '00:00', location: caldr.location, instructor: caldr.instructor, note: caldr.name,
				}
				break;

			default:
				sched = asAt(this.schedule, where, row.date)[0];
				if (!sched)
					throw new Error(`Cannot determine schedule: ${JSON.stringify(where)}`);
		}

		this.service.setAttend(sched, row.note, row.stamp)
			.then(_ => {
				if (rest.length)  										// fire next Attend
					this.nextAttend(rest[0], ...rest.slice(1));
				else this.postAttend();								// wrap-up final Payment
			})
	}

	private async postAttend() {
		const [summary, profile, active] = await Promise.all([
			this.attend.getAmount(),								// get closing balance
			this.attend.getPlan(),									// get final Plan
			this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.uid)),
		]);

		const updates: IStoreMeta[] = [];
		let closed: number;

		this.dbg('account: %j', summary);					// the current account summary
		active.sort(sortKeys('-' + FIELD.stamp));
		if (active[0][FIELD.type] === 'debit' && active[0].approve) {
			closed = active[0].approve[FIELD.stamp];
			if (closed < getStamp() && !active[0][FIELD.expire]) {
				this.dbg('closed: %j, %s', closed, fmtDate(DATE_FMT.display, closed));
				updates.push({ ...active[0], [FIELD.effect]: active[0].stamp, [FIELD.expire]: closed, bank: -summary.pend });
				updates.push({ ...active[1], [FIELD.expire]: active[0].stamp, });
			}
		}

		if (active[0][FIELD.type] === 'topUp' && profile.plan === 'gratis' && active[0].expiry) {
			closed = active[0].expiry;
			if (closed && closed < getStamp() && !active[0][FIELD.expire]) {
				this.dbg('closed: %j, %s', closed, fmtDate(DATE_FMT.display, closed));
				updates.push({ ...active[0], [FIELD.expire]: closed });
			}
		}

		this.data.batch(undefined, updates, undefined, SetMember)
			.then(_ => this.attend.getAmount())		// re-calc the new Account summary
			.then(sum => {
				this.dbg('final: %j', sum);
				this.data.writeAccount(sum);				// update Admin summary
			})
			.then(_ => this.dbg('done'))
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
			.then(_ => this.attend.getAmount())
			.then(sum => this.data.writeAccount(sum))
	}

	async delAttend() {
		const deletes = await this.data.getFire<IAttend>(COLLECTION.attend, { where: addWhere(FIELD.uid, this.current!.user.uid) });
		const payments = await this.data.getStore<IPayment>(STORE.payment, addWhere(FIELD.uid, this.current!.user.uid));
		const updates = payments.map(row => ({					// reset the calculated-fields
			...row, [FIELD.effect]: Number.MIN_SAFE_INTEGER, [FIELD.expire]: Number.MIN_SAFE_INTEGER,
			bank: Number.MIN_SAFE_INTEGER, expiry: Number.MIN_SAFE_INTEGER
		})
		);

		this.dbg('payments: %j', payments);
		this.dbg('updates: %j', updates);
		return this.data.batch(undefined, updates, deletes)
			.then(_ => this.attend.getAmount())
			.then(sum => this.data.writeAccount(sum))
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
