import { Component, OnInit } from '@angular/core';

import { MESSAGE, auth } from '@dbase/data.define';
import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { NavigateService } from '@route/router/navigate.service';

import { isDefined } from '@library/type.library';

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

if (isDefined(Worker)) {
	// Create a new
	const worker = new Worker('./app.worker', { type: 'module' });
	worker.onmessage = ({ data }) => {
		console.log(`page got message: ${data}`);
	};
	worker.postMessage('hello');
} else {
	// Web Workers are not supported in this environment.
	// You should add a fallback so that your program still executes correctly.
}