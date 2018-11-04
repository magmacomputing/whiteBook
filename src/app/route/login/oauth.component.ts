import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { from, Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { AuthService } from '@dbase/auth/auth.service';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit, OnDestroy {
	private dbg: Function = dbg.bind(this);
	private subscription!: Subscription;

	constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService) { }

	ngOnInit() {
		const urlAccess = 'https://us-central1-whitefire-dev.cloudfunctions.net/authAccess';
		const code = this.route.snapshot.queryParamMap.get('code')

		if (code) {
			this.subscription = this.http.post<any>(`${urlAccess}&code=${code}`, {}).pipe(
				tap(res => this.dbg('token: %j', res)),
				switchMap(res => from(this.auth.signInToken(res.authToken)))
			)
				.subscribe()
		}
	}

	ngOnDestroy() {
		this.subscription && this.subscription.unsubscribe();
	}
}
