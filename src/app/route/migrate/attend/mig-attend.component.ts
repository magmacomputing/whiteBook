import { Component, OnInit } from '@angular/core';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-mig-attend',
  templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
  private dbg = dbg(this);
  private url = 'https://sheets.googleapis.com/v4/spreadsheets/16hTR03kU6aZY1am2EtQ2iujllnwIQ7lURE2bHpcXhhw';
  
  constructor() { console.log('migAttend'); }

  ngOnInit() { }

}
