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
}