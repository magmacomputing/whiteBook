import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Store, Select } from '@ngxs/store';
import { ClientState } from '@state/client.state';

import { FireService } from '@dbase/fire/fire.service';
import { IProfilePlan } from '@dbase/app/app.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  @Select(ClientState.plans) provider$!: Observable<IProfilePlan[]>;
  private dbg: Function = dbg.bind(this);

  constructor(private readonly fire: FireService, private readonly store: Store) { }

  ngOnInit() { }
}
