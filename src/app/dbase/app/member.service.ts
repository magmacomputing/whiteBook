import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan } from '@dbase/data/data.interface';
import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService, private readonly store: Store) { this.dbg('new') }

  setPlan(plan: TPlan) {
    const planDoc: IProfilePlan = {
      [FIELD.id]: this.data.newId,                    // generate a new Id
      store: STORE.profile,
      type: 'plan',
      plan: plan,
    }

    this.dbg('plan: %j', planDoc);
    this.data.insDoc(COLLECTION.Member, planDoc)
      .then(_ => this.store.dispatch(new Navigate(['/attend'])))
      .catch(err => this.dbg('setPlan: %j', err))
  }
}
