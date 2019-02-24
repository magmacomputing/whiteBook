import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

interface IAdmin {
	id: string;
	provider: 'fb' | 'g+' | 'gh' | 'li' | 'tw';
	sheetName: string;
	firstName?: string;
	lastName?: string;
	picture?: string;
	isHidden?: boolean;
	isAdmin?: boolean;
}

@Component({
	selector: 'wb-mig-attend',
	templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);
	private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	private prefix = 'alert';
	public members: Promise<IAdmin[]>;

	constructor(private http: HttpClient) {
		const query = 'provider=fb&id=100000138474102';					// 'MichaelM'
		const action = 'signIn';																// signIn as 'admin' to get Register

		this.members = this.fetch(action, query)
			.then(json => json.members)
	}

	ngOnInit() { }

	async getMember(memberName: string) {
		const action = 'history';
		const member = (await this.members).find(member => member.sheetName === memberName);

		if (isUndefined(member)) {
			this.dbg('getMember: not found => %j', memberName);
			return;
		}

		this.fetch(action, `provider=${member.provider}&id=${member.id}`)
			.then(res => {
				const hist = res.history || [];
				this.dbg('get: %j', hist.length);
				this.dbg('get: %j', hist[hist.length - 1]);
				this.dbg('get: %j', hist);
			})
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
