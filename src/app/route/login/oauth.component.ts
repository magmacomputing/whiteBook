import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { StateService } from '@dbase/state/state.service';
import { AuthService } from '@dbase/auth/auth.service';

import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {
	private dbg: Function = dbg.bind(this);

	constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService, private state: StateService) { }

	ngOnInit() {
		const { code, state } = this.route.snapshot.queryParams;

		if (code) {
			this.state.getConfigData('oauth')
				.subscribe(oauth => {
					const url = `${oauth.value.access_url}?code=${code}&state=${state}`;
					this.dbg('oauth: %s', url);

					this.http.post<any>(url, {})
						.subscribe(res => this.auth.signInToken(res))
				})
		}
	}

}
