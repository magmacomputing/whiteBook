import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';

import { AuthService } from '@service/auth/auth.service';
import { SnackService } from '@service/snack/snack.service';
import { MHistory, MRegister } from '@route/migrate/attend/mig.interface';

import { DataService } from '@dbase/data/data.service';
import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment } from '@dbase/data/data.schema';
import { IAccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { IQuery } from '@dbase/fire/fire.interface';

import { TDate } from '@lib/date.library';
import { TString } from '@lib/type.library';
import { sortKeys } from '@lib/object.library';
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

	private register$: Observable<IRegister[]>;
	private data$!: Observable<IAccountState>;
	private history!: Promise<{ history: MHistory[] }>;
	private member: IRegister | null;

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private auth: AuthService, private snack: SnackService, private sync: SyncService) {
		this.member = null;
		this.register$ = this.state.getAdminData()
			.pipe(
				map(admin => admin[COLLECTION.register]),						// get 'register' store
				map(reg => reg.filter(row => !!row.migrate))				// only return 'migrated' members
			)
	}

	ngOnInit() { }

	async signIn(register: IRegister) {
		this.member = register;																	// stash current Member

		this.dbg('register: %j', this.member);
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: this.member.user.uid } };

		this.sync.on(COLLECTION.attend, query);
		this.sync.on(COLLECTION.member, query);

		const action = 'history';
		this.history = this.fetch(action, `provider=${this.member.migrate!.providers.provider}&id=${this.member.migrate!.providers.id}`);
		this.history.then(hist => this.dbg('history: %s', hist.history.length));

		this.data$ = this.state.getAccountData(undefined, this.member.uid)
	}

	async	signOut() {																					// signOut of 'impersonate' mode
		const profile = await this.state.getAuthData()					// get the current Auth'd user
			.pipe(take(1))
			.toPromise();

		const query: IQuery = { where: { fieldPath: FIELD.uid, value: profile.auth.user!.uid } };

		this.member = null;
		this.sync.on(COLLECTION.attend, query);									// restore current User's state
		this.sync.on(COLLECTION.member, query);
	}

	/** get Members data (plan, price, etc), as at supplied date */
	private getAccount(date: TDate) {
		return this.state.getAccountData(date, this.member!.uid)
			.pipe(take(1))
			.toPromise()
	}

	async addPayment() {
		const hist = (await this.history) || { history: [] };
		const creates = hist.history
			.filter(row => row.type === 'Debit')
			.map(row => {
				const approve: { stamp: number; uid: string; note?: TString; } = { stamp: 0, uid: '' };

				if (row.title.substring(0, 10) === 'Approved: ') {
					approve.stamp = row.approved;
					approve.uid = 'JorgeEC';
					if (row.note)
						approve.note = row.note;
				}

				this.dbg('row: %j', row);
				const paym = {
					[FIELD.id]: this.data.newId,
					[FIELD.store]: STORE.payment,
					[FIELD.type]: 'topUp',
					[FIELD.uid]: this.member!.uid,
					stamp: row.stamp,
					amount: parseFloat(row.credit!),
				} as IPayment

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
		const creates = hist.history
			.sort(sortKeys(FIELD.stamp))
			.filter(row => row.type !== 'Debit')
			.map(row => {
				this.dbg('hist: %j', row);

			})
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
