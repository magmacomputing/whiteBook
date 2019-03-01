import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister, IPayment } from '@dbase/data/data.schema';
import { DataService } from '@dbase/data/data.service';
import { MHistory, MRegister } from '@route/migrate/attend/mig.interface';

import { getStamp } from '@lib/date.library';
import { TString } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';
	private static members: Promise<MRegister[]>;
	public class = MigAttendComponent;												// reference to self

	constructor(private http: HttpClient, private data: DataService) { }

	ngOnInit() {
		const query = 'provider=fb&id=100000138474102';					// 'MichaelM'
		const action = 'signIn';																// signIn as 'admin' to get Register

		if (!this.class.members) {
			this.class.members = this.fetch(action, query)
				.then(json => json.members)
		}
	}

	async getMember(member: MRegister) {
		const action = 'history';
		const docs = await this.data.getAll<IRegister>(COLLECTION.register, { where: { fieldPath: 'user.customClaims.memberName', value: member.sheetName } })
			.catch(err => { throw new Error(err) });
		const uid = docs[0][FIELD.uid];

		this.dbg('token: %j', await this.data.createToken(uid));
		this.dbg('member: %s, %j', member.sheetName, docs);
		this.dbg('docs: %j', docs);
		const res = await this.fetch(action, `provider=${member.provider}&id=${member.id}`);
		const hist: MHistory[] = res.history || [];


		// this.dbg('get: %j', hist.length);
		// this.dbg('get: %j', hist[hist.length - 1]);
		// this.dbg('get: %j', hist);

		const creates = hist
			.filter(row => row.type === 'Debit')
			.map(row => {
				const approve: { stamp: number; uid: string; note?: TString; } = { stamp: 0, uid: '' };
				const dt = row.title.substring(10, 16) + '-' + row.date.toString().substring(0, 4);
				this.dbg('date: %j', dt);
				if (row.title.substring(0, 10) === 'Approved: ') {
					approve.stamp = getStamp(dt);
					approve.uid = 'JorgeEC';
					if (row.note)
						approve.note = row.note;
				}

				this.dbg('row: %j', row);
				const paym = {
					[FIELD.id]: this.data.newId,
					[FIELD.store]: STORE.payment,
					[FIELD.type]: 'topUp',
					[FIELD.uid]: uid,
					stamp: row.stamp,
					amount: parseFloat(row.credit!),
				} as IPayment

				if (approve.stamp)
					paym.approve = approve;
				return paym;
			});
		this.dbg('payment: %j', creates[0]);
		// this.data.batch(creates)
		// 	.then(_ => this.dbg('payment: %s', creates.length))
	}

	private async fetch(action: string, query: string) {
		this.dbg('fetch action: %j', action);
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
