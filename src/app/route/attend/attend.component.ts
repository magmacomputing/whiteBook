import { Component, OnInit } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService) { }

  ngOnInit() { }
}
