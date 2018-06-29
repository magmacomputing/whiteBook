import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { IClass } from '@dbase/data/data.interface';
import { DataService } from '@dbase/data/data.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  @Select(ClientState.events) plan$!: Observable<IClass[]>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService) { }

  ngOnInit() { }
}
