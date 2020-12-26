import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';

import { StateService } from '@dbase/state/state.service';
import { AdminService } from '@service/admin/admin.service';

import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-admin',
	templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
	#dbg = dbg(this, 'AdminComponent');

	constructor(private admin: AdminService, public state: StateService) { this.#dbg('init'); }

	ngOnInit(): void { }

	onClick() {
		this.state.getScheduleData('28-Dec-2020')
			.pipe(take(1))
			.subscribe(console.log);
	}
}
