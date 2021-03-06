import { Component, OnInit } from '@angular/core';
import { Store } from '@ngxs/store';

import { Login } from '@dbase/state/auth.action';

@Component({
	selector: 'wb-email',
	templateUrl: './email.component.html',
})
export class EMailComponent implements OnInit {

	constructor(private store: Store) { }

	ngOnInit() {
		this.store.dispatch(new Login.Link(window.location.href));
	}

}
