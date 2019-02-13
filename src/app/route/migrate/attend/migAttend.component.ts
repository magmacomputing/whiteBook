import { Component, OnInit } from '@angular/core';

import { google, sheets_v4 } from 'googleapis';

import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-migrate',
	templateUrl: './migAttend.component.html',
})
export class MigAttendComponent implements OnInit {
	private dbg = dbg(this);

	constructor() { }

	ngOnInit() {
		const sheets = google.sheets('v4');
		const request: sheets_v4.Params$Resource$Spreadsheets$Get = {
			spreadsheetId: '16hTR03kU6aZY1am2EtQ2iujllnwIQ7lURE2bHpcXhhw',
			ranges: ['A1:F13'],
		};

		sheets.spreadsheets.get(request)
			.then(response => console.log('response: ', response));
	}

}
