import { Component, OnInit } from '@angular/core';
import { Store } from '@ngxs/store';

import { FireService } from '@dbase/fire/fire.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  private dbg: Function = dbg.bind(this);

  constructor(private readonly fire: FireService, private readonly store: Store) { }

  ngOnInit() { }
}
