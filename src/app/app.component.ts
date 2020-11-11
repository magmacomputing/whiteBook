import { Component, OnInit } from '@angular/core';

import { MESSAGE, auth } from '@dbase/data.define';
import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { NavigateService } from '@route/router/navigate.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
	public app$ = this.state.getMemberData();
	public MESSAGE = MESSAGE;
	public ROLE = auth.ROLE;

	constructor(readonly data: DataService, readonly state: StateService, readonly navigate: NavigateService) { }

	ngOnInit() { }
}
