import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { FireService } from '@dbase/fire/fire.service';
import { MHistory, MRegister } from '@route/migrate/attend/mig.interface';

import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';
	public members!: Promise<MRegister[]>;

	constructor(private http: HttpClient, private fire: FireService) { }

	ngOnInit() {
		const query = 'provider=fb&id=100000138474102';					// 'MichaelM'
		const action = 'signIn';																// signIn as 'admin' to get Register

		this.members = this.fetch(action, query)
			.then(json => json.members)
	}

	async getMember(member: MRegister) {
		const action = 'history';
		const docs = await this.fire.getAll(COLLECTION.register, { where: { fieldPath: 'user.customClaims.memberName', value: member.sheetName } })
			.catch(err => { throw new Error(err) });
		const res = await this.fetch(action, `provider=${member.provider}&id=${member.id}`);
		const hist: MHistory[] = res.history || [];

		const uid = docs[0][FIELD.id];
		this.dbg('member: %s, %j', member.sheetName, docs);
		// this.dbg('get: %j', hist.length);
		// this.dbg('get: %j', hist[hist.length - 1]);
		// this.dbg('get: %j', hist);

		hist
			.filter(row => row.type === 'Debit')
			.forEach(row => this.dbg('row: %j', row))
	}

	private async fetch(action: string, query: string) {
		this.dbg('fetching... %j', action);
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
