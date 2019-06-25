import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { NavigateService } from '@route/router/navigate.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
	public app$ = this.state.getMemberData();								// per-member message

	constructor(readonly data: DataService, readonly state: StateService, private navigate: NavigateService, private sanitize: DomSanitizer) { }

	ngOnInit() { }

	clickMe() {
		console.log('click me');
	}
}
