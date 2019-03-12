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
import { IRegister, IPayment, TStoreBase, ISchedule } from '@dbase/data/data.schema';
import { IAccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { IQuery, TWhere } from '@dbase/fire/fire.interface';

import { TDate, fmtDate, DATE_FMT } from '@lib/date.library';
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
	public class = MigAttendComponent;												// reference to self

	private admin$: Observable<IRegister[]>;
	private data$!: Observable<IAccountState>;
	private history!: Promise<{ history: MHistory[] }>;
	private member: IRegister | null;
	private schedule!: ISchedule[];

	private lookup: IObject<string> = {
		oldStep: 'MultiStep',
		prevStep: 'MultiStep',
		Step: 'MultiStep',
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

		const where: TWhere = { fieldPath: FIELD.store, value: STORE.schedule };
		this.data.getAll<ISchedule>(COLLECTION.client, { where })
			.then(schedule => this.schedule = schedule);
	}

	ngOnInit() { }

	async signIn(register: IRegister) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: register.user.uid } };
		this.member = register;																	// stash current Member

		this.sync.on(COLLECTION.attend, query);
		this.sync.on(COLLECTION.member, query);

		const action = 'history';
		const { id, provider } = this.member.migrate!.providers[0];
		this.history = this.fetch(action, `provider=${provider}&id=${id}`);
		this.history.then(hist => this.dbg('history: %s', hist.history.length));

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

	/** get Members data (plan, price, etc), as at supplied date */
	private getAccount(date: TDate) {
		return this.state.getAccountData(this.member!.uid, date)
			.pipe(take(1))
			.toPromise()
	}

	async addPayment() {
		const hist = (await this.history) || { history: [] };
		const creates = hist.history
			.filter(row => row.type === 'Debit' || row.type === 'Credit')
			.map(row => {
				const approve: { stamp: number; uid: string; } = { stamp: 0, uid: '' };

				if (row.title.substring(0, 10) === 'Approved: ') {
					approve.stamp = row.approved;
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
	 * 1. 	filter != 'Debit'
	 * 2.		sort(stamp)
	 * 		forEach =>
	 * 3.		convert event into a standard (eg.  'OldStep' -> 'Step')
	 * 4.		determine price should have been charged asAt date
	 * 5.		if !== hist.amount, abort   and log
	 * 6.		determine active Payment
	 * 7.		determine price paid for active Payment   (amount + bank)
	 * 8.		determine if price-to-pay will exceed price-paid - sum(active.attends)
	 * 		if so, expire active Payment, determine next Payment and rollover unused active-credit to bank
	 * 9. 	if no effect date, set hist.stamp on activePayment
	 * 10.	build Attend
	 * 11.	batch Attends?   (if so, how will rolling credit be calc'd ?)
	 */
	async addAttend() {
		const hist = (await this.history) || { history: [] };
		// const hist = { history: [{ "stamp": 1425086244, "date": 20150228, "type": "oldStep", "title": "<span style=\"color:#0000ff;\">oldStep</span>", "debit": "-8.00" } as MHistory] };

		hist.history.length = Math.min(hist.history.length, 10);				// gimme only the first 10-attendances
		hist.history
			.sort(sortKeys(FIELD.stamp))
			.filter(row => row.type !== 'Debit' && row.type !== 'Credit')
			.map(row => {
				this.dbg('hist: %j', row);
				const event = this.lookup[row.type] || row.type;
				const dow = fmtDate(DATE_FMT.weekDay, row.date);
				const where: TWhere = [
					{ fieldPath: FIELD.key, value: event },
					{ fieldPath: 'day', value: dow },
				]
				const sched = asAt(this.schedule, where, row.date)[0];
				this.dbg('schedule: %j', sched);
				if (!sched)
					throw new Error(`Cannot determine schedule: ${where}`);

				this.service.setAttend(sched, row.note, row.stamp, this.member!.user.uid);
			})
	}

	async delPayment() {
		const where: TWhere = [
			{ fieldPath: FIELD.store, value: STORE.payment },
			{ fieldPath: FIELD.uid, value: this.member!.user.uid },
		]
		const deletes = await this.data.getAll<TStoreBase>(COLLECTION.member, { where });

		where.length = 0;													// truncate where-clause
		where.push({ fieldPath: FIELD.uid, value: this.member!.user.uid });
		deletes.push(...await this.data.getAll<TStoreBase>(COLLECTION.attend, { where }));

		return this.data.batch(undefined, undefined, deletes)
	}

	async delAttend() {
		const where: TWhere = [{ fieldPath: FIELD.uid, value: this.member!.user.uid }];
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
