import { Component, OnInit } from '@angular/core';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-mig-attend',
  templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
  private dbg = dbg(this);
  
  constructor() { console.log('migAttend'); }

  ngOnInit() { }

}
