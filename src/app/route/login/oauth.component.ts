import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AuthService } from '@dbase/auth/auth.service';

@Component({
	selector: 'wb-oauth',
	templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {

	constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService) { }

	ngOnInit() {
		const urlAccess = 'https://us-central1-whitefire-dev.cloudfunctions.net/authAccess';
		const code = this.route.snapshot.queryParamMap.get('code')

		if (code) {
			this.http.post<any>(`${urlAccess}&code=${code}`, {}).pipe(
				switchMap(res => from(this.auth.signInToken(res.authToken)))
			)
		}
	}
}
