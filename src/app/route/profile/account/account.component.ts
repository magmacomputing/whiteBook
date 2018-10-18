import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MemberService } from '@dbase/app/member.service';
import { IAccountState } from '@dbase/state/state.library';
import { StateService } from '@dbase/state/state.service';

import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-account',
	templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
	public data$!: Observable<IAccountState>;
	private dbg: Function = dbg.bind(this);

	constructor(readonly state: StateService, readonly member: MemberService) { }

	ngOnInit() {
		this.data$ = this.state.getAccountData().pipe(
			tap(data => this.dbg('account: %j', data)),
		)
	}

}
