import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { IProfilePlan } from '@dbase/data/data.interface';
import { DataService } from '@dbase/data/data.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-profile',
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  @Select(ClientState.plans) plan$!: Observable<IProfilePlan[]>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService) { }

  ngOnInit() { }

  setPlan(plan: string) {
    this.dbg('plan: %j', plan);
  }
}
