import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '@service/auth/auth.service';
import { StateService } from '@dbase/state/state.service';
import { getConfig } from '@library/config.library';

import { STORE } from '@dbase/data/data.define';
import { IConfig } from '@dbase/data/data.schema';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {
	private dbg = dbg(this);

	constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService, private state: StateService) { }

	ngOnInit() {
		const { code, state } = this.route.snapshot.queryParams;

		if (code) {
			this.state.asPromise(this.state.getCurrent<IConfig>(STORE.config))
				.then(config => getConfig(config, 'oauth'))
				.then(oauth => {
					const url = `${oauth.value.access_url}?code=${code}&state=${state}`;
					this.dbg('oauth: %s', url);

					this.http.post<any>(url, {})
						.subscribe(res => this.auth.signInToken(res))
						.unsubscribe()
				})
				.catch(err => this.dbg('error: %s', err.message))
		}
	}

	canDeactivate() {
		this.dbg('deactivate: %s', false);
		return false;											// once on this page, cannot move away
	}
}
