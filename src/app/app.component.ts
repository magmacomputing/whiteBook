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

	// getBackground(image: string) {
	// 	console.log('image: %j', image);
	// 	return this.sanitize.bypassSecurityTrustStyle(`linear-gradient(rgba(29, 29, 29, 0), rgba(16, 16, 23, 0.5)), url(${image})`);
	// }
}
