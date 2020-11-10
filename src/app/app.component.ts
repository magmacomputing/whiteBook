import { Component, OnInit } from '@angular/core';

import { MESSAGE, Auth } from '@dbase/data.define';
import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { isEqual } from '@library/object.library';

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

	constructor(readonly data: DataService, readonly state: StateService, readonly navigate: NavigateService) {
const obj1 = {one:1};
const obj2 = {two:2};
		console.log('deep: ', isEqual(obj1, obj2));
	}

	ngOnInit() { }
}
