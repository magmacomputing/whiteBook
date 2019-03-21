import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { take, map, debounce } from 'rxjs/operators';
import { Actions, ofActionDispatched, Store } from '@ngxs/store';

import { MemberService } from '@service/member/member.service';
import { MHistory } from '@route/migrate/attend/mig.interface';
import { DataService } from '@dbase/data/data.service';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment, TStoreBase, ISchedule, IEvent, ICalendar, IAttend } from '@dbase/data/data.schema';
import { asAt } from '@dbase/library/app.library';
import { AuthOther } from '@dbase/state/auth.action';
import { NewAttend } from '@dbase/state/state.action';
import { IAccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { fmtDate, DATE_FMT, getDate } from '@lib/date.library';
import { sortKeys, IObject } from '@lib/object.library';
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
		private sync: SyncService, private service: MemberService, private store: Store, private actions: Actions) {
		this.current = null;
		this.register$ = this.state.getAdminData()
			.pipe(
				map(admin => admin[STORE.register]),								// get 'register' store
				map(reg => (reg || []).filter(row => row.migrate)),	// only return 'migrated' members
				map(reg => reg.sort(sortKeys('user.customClaims.memberName'))),
			)

		this.data.getAll<ISchedule>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.schedule) })
			.then(schedule => this.schedule = schedule);
		this.data.getAll<ICalendar>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.calendar) })
			.then(calendar => this.calendar = calendar);
		this.data.getAll<IEvent>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.event) })
			.then(events => this.events = events);
		this.state.getAuthData()																	// stash the current Auth'd user
			.pipe(take(1))
			.toPromise()
			.then(auth => this.user = auth.auth.user)
	}

	ngOnInit() { }

	async signIn(register: IRegister) {
		this.current = register;																	// stash current Member

		this.store.dispatch(new AuthOther(register.uid))
			.subscribe(_other => {
				const query: IQuery = { where: addWhere(FIELD.uid, [this.user!.uid, register.user.uid]) };
				this.dbg('query: %j', query);
				this.sync.on(COLLECTION.attend, query);
				this.sync.on(COLLECTION.member, query);

				const action = 'history';
				const { id, provider } = register.migrate!.providers[0];
				this.history = this.fetch(action, `provider=${provider}&id=${id}`)
					.then((resp: { history: MHistory[] }) => (resp.history || []).sort(sortKeys(FIELD.stamp)));
				this.history.then(hist => this.dbg('history: %s', hist.length));

				this.account$ = this.state.getAccountData(register.uid)
			})
			.unsubscribe()
	}

	async	signOut() {																					// signOut of 'impersonate' mode
		this.store.dispatch(new AuthOther(this.user!.uid))
			.subscribe(_other => {
				const query: IQuery = { where: addWhere(FIELD.uid, this.user!.uid) };

				this.current = null;
				this.sync.on(COLLECTION.attend, query);							// restore Auth User's state
				this.sync.on(COLLECTION.member, query);
			});
	}

	async addPayment() {
		const hist = (await this.history) || [];
		const creates = hist
			.filter(row => row.type === 'Debit' || row.type === 'Credit')
			.map(row => {
				const approve: { stamp: number; uid: string; } = { stamp: 0, uid: '' };

				if (row.title.startsWith('Approved: ')) {
					approve.stamp = row.approved!;
					approve.uid = 'JorgeEC';
				}

				this.dbg('row: %j', row);
				const paym = {
					[FIELD.id]: this.data.newId,
					[FIELD.store]: STORE.payment,
					[FIELD.type]: 'topUp',
					[FIELD.uid]: this.current!.uid,
					stamp: row.stamp,
					amount: parseFloat(row.credit!),
					// bank: row.bank,															// bank will be auto-calculated
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

	/**
	 * Add Attendance records for a Member
	 */
	async addAttend() {
		const table = (await this.history)								// a sorted-list of Attendance check-ins / account payments
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.slice(0, 15)																		// for testing: just the first few Attends

		table.length = 0;
		table.push({
			"stamp": 1411469381,
			"date": 20130329,
			"type": "Routine*2 Classes",
			"title": "<span style=\"color:#5b2012;\">Routine*2 Classes</span>",
			"debit": "-20.00",
			"funds": 150
		});
		table.push({
			"stamp": 1545296400,
			"date": 20181220,
			"type": "AeroStep",
			"title": "<span style=\"color:#ff8135;\">AeroStep</span>",
			"debit": "-10.00",
			"funds": 170
		});
		this.newAttend(table[0], ...table.slice(1));
	}

	newAttend(row: MHistory, ...rest: MHistory[]) {
		this.dbg('hist: %j', row);
		const what = this.lookup[row.type] || row.type;
		const dow = fmtDate(DATE_FMT.weekDay, row.date);
		const where = [
			addWhere(FIELD.key, what),
			addWhere('day', dow),
		]

		const [prefix, suffix, ...none] = what.split('*');
		let sched: ISchedule;
		if (this.special.includes(prefix)) {					// dummy-up a Schedule
			const caldr = asAt(this.calendar, addWhere(FIELD.key, row.date), row.date)[0];
			const event = asAt(this.events, addWhere(FIELD.key, caldr[FIELD.type]))[0];
			const cnt = parseInt(suffix.split(' ')[0], 10);

			if (!caldr)
				throw new Error(`Cannot determine calendar: ${row.date}`);

			sched = {
				[FIELD.store]: STORE.schedule, [FIELD.type]: 'event', [FIELD.id]: caldr[FIELD.id], [FIELD.key]: event.classes[cnt < 0 ? Math.abs(cnt) : 0],
				day: getDate(caldr.key).ww, start: caldr.start || '09:00', location: caldr.location, instructor: caldr.instructor
			};

			for (let nbr = 1; nbr < cnt; nbr++) {				// stack additional attends
				row.type = prefix + '*-' + nbr;						// TODO: determine if ZumbaStep via the row.amount
				rest.splice(0, 0, row);
				this.dbg('splice: %j', rest);
			}
		} else {
			sched = asAt(this.schedule, where, row.date)[0];
			if (!sched)
				throw new Error(`Cannot determine schedule: ${JSON.stringify(where)}`);
		}

		const sub = this.actions.pipe(
			ofActionDispatched(NewAttend),							// we have to wait for FireStore to sync with NGXS, so we get latest account-details
			debounce(_ => timer(500)),									// wait to have State settle
		)																							// wait for new Attend to sync into State
			.subscribe(row => {
				this.dbg('sync: %j', row);
				sub.unsubscribe();
				if (rest.length)
					this.newAttend(rest[0], ...rest.slice(1));
			});
		return this.service.setAttend(sched, row.note, row.stamp, this.current!.user.uid);
	}

	async delPayment() {
		const where = [
			addWhere(FIELD.store, STORE.payment),
			addWhere(FIELD.uid, this.current!.user.uid),
		]
		const deletes = await this.data.getAll<TStoreBase>(COLLECTION.member, { where });

		where.length = 0;													// truncate where-clause
		where.push(addWhere(FIELD.uid, this.current!.user.uid));
		deletes.push(...await this.data.getAll<TStoreBase>(COLLECTION.attend, { where }));

		return this.data.batch(undefined, undefined, deletes)
	}

	async delAttend() {
		const deletes = await this.data.getAll<IAttend>(COLLECTION.attend, { where: addWhere(FIELD.uid, this.current!.user.uid) });
		const pays = deDup(...deletes.map(row => row.payment));
		const payments = await this.data.getStore<IPayment>(STORE.payment, [
			addWhere(FIELD.uid, this.current!.user.uid),
			addWhere(FIELD.id, pays),											// get any Payment which is referenced by the Attend documents
		])
		const updates = payments.map(row => ({ ...row, [FIELD.expire]: Number.MIN_SAFE_INTEGER, [FIELD.effect]: Number.MIN_SAFE_INTEGER }));

		this.dbg('payments: %j', payments);
		this.dbg('updates: %j', updates);
		return this.data.batch(undefined, updates, deletes);
	}

	private async fetch(action: string, query: string) {
		this.dbg('fetch: %j, %j', action, query);
		const res = await this.http
			.get(`${this.url}?${query}&action=${action}&prefix=${this.prefix}`, { responseType: 'text' })
			.toPromise()
		const json = res.substring(0, res.length - 1).substring(this.prefix.length + 1, res.length);

		try {
			const obj = JSON.parse(json);
			return obj[action];
		} catch (err) {
			this.dbg('not a valid JSON');
			return {}
		}
	}
}
