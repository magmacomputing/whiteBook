import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthService } from '@service/auth/auth.service';
import { SnackService } from '@service/snack/snack.service';
import { MHistory, MRegister } from '@route/migrate/attend/mig.interface';

import { DataService } from '@dbase/data/data.service';
import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment } from '@dbase/data/data.schema';
import {  IAccountState } from '@dbase/state/state.define';
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

	private static members: Promise<MRegister[]>;
	private static history: Promise<{ history: MHistory[] }>;
	private static member: MRegister | null;
	private static register: Promise<IRegister[]>;
	private static data$: Observable<IAccountState>;

	constructor(private http: HttpClient, private data: DataService, private state: StateService, private auth: AuthService, private snack: SnackService, private sync: SyncService) { }

	ngOnInit() {
		if (!this.class.members) {
			const query = 'provider=gh&id=6935496';		// 'MichaelM.gh'
			const action = 'signIn';																// signIn as 'admin' to get Register

			this.class.members = this.fetch(action, query)
				.then(json => json.members)
		}
		if (!this.class.register) {
			this.class.register = this.data.getAll<IRegister>(COLLECTION.register);
		}
	}

	async signIn(member: MRegister) {
		this.class.member = await this.getRegister(member.sheetName);	// stash current Member

		this.dbg('register: %j', this.class.member);
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: this.class.member.uid } };

		this.sync.on(COLLECTION.attend, query);
		this.sync.on(COLLECTION.member, query);

		const action = 'history';
		this.class.history = this.fetch(action, `provider=${this.class.member.provider}&id=${this.class.member.id}`);
		this.class.history.then(hist => this.dbg('history: %s', hist.history.length));

		this.class.data$ = this.state.getAccountData(undefined, this.class.member.uid)
	}

	async	signOut() {
		const profile = await this.getRegister('MichaelM');
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: profile[FIELD.uid] } };

		this.class.member = null;
		this.sync.on(COLLECTION.attend, query);
		this.sync.on(COLLECTION.member, query);
	}

	/** combine an MRegister (Google Sheets register) with an IRegister (Firestore register) */
	private async getRegister(sheetName: string) {
		const [register, profile] = await Promise.all([
			this.class.register.then(reg => reg.find(row => row.user.customClaims.memberName === sheetName)),
			this.class.members.then(mbr => mbr.find(row => row.sheetName === sheetName)),
		]);
		this.class.register.then(reg => this.dbg('register: %j', reg));

		return { ...profile!, [FIELD.uid]: register!.user.uid }
	}

	/** get Members data (plan, price, etc), as at supplied date */
	private getAccount(date: TDate) {
		return this.state.getAccountData(date, this.class.member!.uid)
			.pipe(take(1))
			.toPromise()
	}

	async addPayment() {
		const hist = (await this.class.history) || { history: [] };
		const creates = hist.history
			.filter(row => row.type === 'Debit')
			.map(row => {
				const approve: { stamp: number; uid: string; note?: TString; } = { stamp: 0, uid: '' };
				// const dt = row.title.substring(10, 16) + '-' + row.date.toString().substring(0, 4);
				// this.dbg('date: %j', dt);
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
					[FIELD.uid]: this.class.member!.uid,
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
		const hist = (await this.class.history) || { history: [] };
		const creates = hist.history
			.sort(sortKeys(FIELD.stamp))
			// .filter(row => row.type !== 'Debit')
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
