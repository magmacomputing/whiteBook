import { Component, OnInit } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { NavigateService } from '@route/router/navigate.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
	public app$ = this.state.getMemberData();								// per-member message

	constructor(readonly data: DataService, readonly state: StateService, private navigate: NavigateService) { }

	ngOnInit() { }

}
