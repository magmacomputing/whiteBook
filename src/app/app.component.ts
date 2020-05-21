import { Component, OnInit } from '@angular/core';

import { MESSAGE, Auth } from '@dbase/data/data.define';
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
	public ROLE = Auth.ROLE;

	constructor(readonly data: DataService, readonly state: StateService, readonly navigate: NavigateService) { }

	ngOnInit() { }
}
