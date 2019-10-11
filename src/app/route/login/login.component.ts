import { Component, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '@service/auth/auth.service';
import { MemberService } from '@service/member/member.service';
import { DataService } from '@dbase/data/data.service';

import { FIELD, Auth, STORE } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { StateService } from '@dbase/state/state.service';

import { drag } from '@lib/html.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
	public provider$!: Observable<IProvider[]>;
	private dbg = dbg(this);

	constructor(private readonly state: StateService, private readonly auth: AuthService,
		private readonly data: DataService, private readonly member: MemberService) { }

	ngOnInit() {
		this.provider$ = this.state.getProviderData().pipe(
			map(source => source.client.provider.filter(row => !row[FIELD.hidden]))
		)
	}

	signIn(provider: IProvider) {
		const opts: { email?: string, password?: string } = {};

		if (provider[FIELD.type] === 'email') {
			opts.email = prompt('Enter your email address...') || undefined;
			opts.password = prompt('Enter your password...') || undefined;
		}

		this.auth.signIn(provider, opts)
			.then(_ => this.member.listenInfo());
	}

	drop(event: CdkDragDrop<any[]>) {
		drag(event);
	}

	async getToken() {
		const access_token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImQ2YzM5Mzc4YWVmYzA2YzQyYTJlODI1OTA0ZWNlZDMwODg2YTk5MjIiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiTWljaGFlbCBNY1JhZSIsInBpY3R1cmUiOiJodHRwczovL2dyYXBoLmZhY2Vib29rLmNvbS8xMDAwMDAxMzg0NzQxMDIvcGljdHVyZSIsImNsYWltcyI6eyJhbGlhcyI6Ik1pY2hhZWxNIiwicm9sZXMiOlsiYWRtaW4iXX0sImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS93aGl0ZWZpcmUtZGV2IiwiYXVkIjoid2hpdGVmaXJlLWRldiIsImF1dGhfdGltZSI6MTU2ODE2MDI3NCwidXNlcl9pZCI6Ik1pY2hhZWxNIiwic3ViIjoiTWljaGFlbE0iLCJpYXQiOjE1NzA3NDQ4ODIsImV4cCI6MTU3MDc0ODQ4MiwiZW1haWwiOiJtaWNoYWVsQG1hZ21hY29tcHV0aW5nLmNvbS5hdSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7InR3aXR0ZXIuY29tIjpbIjIzOTE4MDAyMTUiXSwiZ29vZ2xlLmNvbSI6WyIxMTAwMjE4MTM0OTY1MTAzNzU5NTciXSwiZ2l0aHViLmNvbSI6WyI2OTM1NDk2Il0sImxpbmtlZGluLmNvbSI6WyJDamZqS2R0TlhTIl0sImZhY2Vib29rLmNvbSI6WyIxMDAwMDAxMzg0NzQxMDIiXSwiZW1haWwiOlsibWljaGFlbEBtYWdtYWNvbXB1dGluZy5jb20uYXUiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.clS714hRLuyk0H7_x1W1Ke12oRtTXaypHYUI56ClUwvORwMnR3KHYoi6FzmSU246hMqYDTzNx9Dz5XPoEE7Ahow_uh5P3CuGizBlDFfIY7var8TMSlTjQSsv9zRkEYro6JTRvEPjuLAigvNmZdNFj2je7WSrnvN8otjaTl1xMiDhh1xR4bHsKAGPXu8RB-eL6v5tW8nhiU_t2PBlwSFsfF-gWcOVtsDuLX1vnzUPGFWIFVr4xSiBdU9jh5UBcPg0Ncddfvd5Y5-Y6RC_sky8MV-xod69VPkW1hDXq5wiiQKdMC0XcMUSEVjtT7w9Qd0MSb8QunqeOK8Bg6y7lL9qJg';

		const user = {
			uid: 'BronwynX',
			email: "bronwyn.hingXXX@vicinity.com.au",
			displayName: "BronwynX Hing",
			photoURL: "https://komarketing.com/images/2014/08/linkedin-default.png",
			phoneNumber: '',
			providerId: 'linkedin.com',
		}

		try {
			const token = await this.data.authToken(access_token, user)
			const provider: IProvider = {
				[FIELD.id]: '',
				[FIELD.store]: STORE.provider,
				[FIELD.type]: Auth.METHOD.custom,
				[FIELD.key]: Auth.METHOD.custom,
			}
			this.auth.signIn(provider, { jwt: token })
				.then(res => this.dbg('afAuth: %j', res))
				.catch(err => this.dbg('error: %j', err.message))
		} catch (error) {
			this.dbg('error: %j', error.message);
		}
	}
}