import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { MemberService } from '@dbase/app/member.service';
import { IPrice } from '@dbase/data/data.interface';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.prices) price$!: Observable<IPrice[]>;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }
}
