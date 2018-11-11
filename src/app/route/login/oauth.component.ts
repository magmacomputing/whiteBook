import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { from, Observable, timer } from 'rxjs';
import { tap, switchMap, delay } from 'rxjs/operators';

import { AuthService } from '@dbase/auth/auth.service';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {
	private dbg: Function = dbg.bind(this);
	private sub!: Observable<any>;

	constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router, private auth: AuthService) { }

	ngOnInit() {
		const { code, state } = this.route.snapshot.queryParams;

		if (code) {
			const urlAccess = 'https://us-central1-whitefire-dev.cloudfunctions.net/authAccess';
			const url = `${urlAccess}?prefix=li&code=${code}&state=${state}`;

			this.sub = this.http.post<any>(url, {}).pipe(
				switchMap(res => from(this.auth.signInToken(res.token))),
				// tap(done => this.dbg('done')),
				// delay(5000),
				// tap(done => window.close()),
			)
		}
	}

}
