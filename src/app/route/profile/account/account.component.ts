import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { MemberService } from '@service/member/member.service';
import { AccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';

import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-account',
	templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
	public data$!: Observable<AccountState>;
	#dbg = dbg(this);

	constructor(readonly state: StateService, readonly member: MemberService) { 	}

	ngOnInit() {
		// this.data$ = this.state.getAccountData().pipe(
		// 	// tap(data => this.dbg('account: %j', data.account.attend)),
		// )
	}

}
