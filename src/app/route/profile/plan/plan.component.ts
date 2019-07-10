import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { MemberService } from '@service/member/member.service';
import { DialogService } from '@service/material/dialog.service';

import { IPlanState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD } from '@dbase/data/data.define';
import { IPrice } from '@dbase/data/data.schema';

import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-plan',
	templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
	public data$!: Observable<IPlanState>;
	private dbg = dbg(this);

	constructor(private readonly member: MemberService, private readonly state: StateService, public dialog: DialogService) { }

	ngOnInit() {
		this.data$ = this.state.getPlanData().pipe(
			map(source => {
				source.client.plan = source.client.plan.filter(row => !row[FIELD.hidden])
				return source;
			})
		)
	}

	showPlan(plan: string, price: IPrice[]) {
		this.dbg('show: %j', price.filter(price => price[FIELD.key] === plan));
		this.dialog.open('Blah, blah, blah');
	}
}
