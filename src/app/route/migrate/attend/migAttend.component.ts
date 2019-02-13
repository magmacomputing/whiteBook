import { Component, OnInit } from '@angular/core';

import { google, sheets_v4 } from 'googleapis';

@Component({
	selector: 'wb-migrate',
	templateUrl: './migAttend.component.html',
})
export class MigAttendComponent implements OnInit {

	constructor() { }

	ngOnInit() {
		const sheets = google.sheets('v4');
		const request = {//: sheets_v4.Params$Resource$Spreadsheets$Get = {
			spreadsheetId: '16hTR03kU6aZY1am2EtQ2iujllnwIQ7lURE2bHpcXhhw',
			ranges: ['A1:F13'],
		};

		sheets.spreadsheets.get(request)
			.then(response => console.log('response: ', response));
	}

}
