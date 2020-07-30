import { Component, OnInit } from '@angular/core';

import { AdminService } from '@service/admin/admin.service';

@Component({
	selector: 'wb-admin',
	templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {

	constructor(private admin: AdminService) { }

	ngOnInit(): void { }

}
