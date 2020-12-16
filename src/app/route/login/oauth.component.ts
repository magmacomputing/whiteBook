import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '@service/auth/auth.service';
import { DataService } from '@dbase/data/data.service';
import { getConfig } from '@dbase/state/config.library';

import { STORE } from '@dbase/data.define';
import { Config } from '@dbase/data.schema';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {
	#dbg = dbg(this);

	constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService, private data: DataService) { }

	ngOnInit() {
		const { code, state } = this.route.snapshot.queryParams;

		if (code) {
			this.data.getCurrent<Config>(STORE.Config)
				.then(config => getConfig(config, STORE.Provider, 'oauth'))
				.then(oauth => {
					const url = `${oauth.value.access_url}?code=${code}&state=${state}`;
					this.#dbg('oauth: %s', url);

					this.http.post<any>(url, {})
						.subscribe(res => this.auth.signInToken(res))
				})
				.catch(err => this.#dbg('error; %s', err.message))
		}
	}

	canDeactivate() {
		this.#dbg('deactivate: %s', false);
		return false;											// once on this page, cannot move away
	}
}
