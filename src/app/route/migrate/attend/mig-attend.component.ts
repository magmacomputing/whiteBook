import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';

import { AuthService } from '@service/auth/auth.service';
import { SnackService } from '@service/snack/snack.service';
import { MemberService } from '@service/member/member.service';
import { MHistory } from '@route/migrate/attend/mig.interface';
import { DataService } from '@dbase/data/data.service';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment, TStoreBase, ISchedule, IEvent, ICalendar } from '@dbase/data/data.schema';
import { IAccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { fmtDate, DATE_FMT } from '@lib/date.library';
import { sortKeys, IObject } from '@lib/object.library';
import { asAt } from '@dbase/library/app.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';

	private admin$: Observable<IRegister[]>;
	private data$!: Observable<IAccountState>;
	private history!: Promise<MHistory[]>;
	private member: IRegister | null;
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

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private auth: AuthService,
		private snack: SnackService, private sync: SyncService, private service: MemberService) {
		this.member = null;
		this.admin$ = this.state.getAdminData()
			.pipe(
				map(admin => admin[STORE.register]),								// get 'register' store
				map(reg => (reg || []).filter(row => !!row.migrate)),	// only return 'migrated' members
				map(reg => reg.sort(sortKeys(FIELD.uid))),
			)

		this.data.getAll<ISchedule>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.schedule) })
			.then(schedule => this.schedule = schedule);
		this.data.getAll<ICalendar>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.calendar) })
			.then(calendar => this.calendar = calendar);
		this.data.getAll<IEvent>(COLLECTION.client, { where: addWhere(FIELD.store, STORE.event) })
			.then(events => this.events = events);
	}

	ngOnInit() { }

	async signIn(register: IRegister) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: register.user.uid } };
		this.member = register;																	// stash current Member

		this.sync.on(COLLECTION.attend, query);
		this.sync.on(COLLECTION.member, query);

		const action = 'history';
		const { id, provider } = this.member.migrate!.providers[0];
		this.history = this.fetch(action, `provider=${provider}&id=${id}`)
			.then((resp: { history: MHistory[] }) => (resp.history || []).sort(sortKeys(FIELD.stamp)));
		this.history.then(hist => this.dbg('history: %s', hist.length));

		this.data$ = this.state.getAccountData(this.member.uid)
	}

	async	signOut() {																					// signOut of 'impersonate' mode
		const profile = await this.state.getAuthData()					// get the current Auth'd user
			.pipe(take(1))
			.toPromise();
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: profile.auth.user!.uid } };

		this.data$ = this.state.getAccountData(profile.auth.user!.uid);
		this.member = null;
		this.sync.on(COLLECTION.attend, query);									// restore current User's state
		this.sync.on(COLLECTION.member, query);
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
					[FIELD.uid]: this.member!.uid,
					stamp: row.stamp,
					amount: parseFloat(row.credit!),
					bank: row.bank,
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
		(await this.history)								// a sorted-list of Attendance check-ins / account payments
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.slice(0, 15)											// for testing: just the first few Attends
			.map(async row => {
				this.dbg('hist: %j', row);
				const what = this.lookup[row.type] || row.type;
				const dow = fmtDate(DATE_FMT.weekDay, row.date);
				const where = [
					addWhere(FIELD.key, what),
					addWhere('day', dow),
				]
				const sched = asAt(this.schedule, where, row.date)[0];
				const caldr = asAt(this.calendar, addWhere(FIELD.key, row.date), row.date)[0];

				this.dbg('schedule: %j, %j, %j', sched, caldr);
				if (!sched)
					throw new Error('Cannot determine schedule: ' + JSON.stringify(where));

				await this.service.setAttend(sched, row.note, row.stamp, this.member!.user.uid);
			})
	}

	async delPayment() {
		const where = [
			addWhere(FIELD.store, STORE.payment),
			addWhere(FIELD.uid, this.member!.user.uid),
		]
		const deletes = await this.data.getAll<TStoreBase>(COLLECTION.member, { where });

		where.length = 0;													// truncate where-clause
		where.push(addWhere(FIELD.uid, this.member!.user.uid));
		deletes.push(...await this.data.getAll<TStoreBase>(COLLECTION.attend, { where }));

		return this.data.batch(undefined, undefined, deletes)
	}

	async delAttend() {
		const where = addWhere(FIELD.uid, this.member!.user.uid);
		const deletes = await this.data.getAll<TStoreBase>(COLLECTION.attend, { where });

		return this.data.batch(undefined, undefined, deletes);
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
