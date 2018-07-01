import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { MemberService } from '@dbase/app/member.service';
import { IStoreDoc } from '@dbase/state/store.define';
import { IPrice } from '@dbase/data/data.interface';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.getClient) client$!:
    Observable<(store: string, type?: string) => IStoreDoc[]>;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get price$() {
    return (this.client$).pipe(
      map(fn => fn('price', 'topUp')))
  }
}
