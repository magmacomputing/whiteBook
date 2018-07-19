import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass } from '@dbase/data/data.interface';
import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService, private readonly store: Store) { this.dbg('new') }

  setPlan(plan: TPlan) {
    const planDoc: IProfilePlan = {
      [FIELD.id]: this.data.newId,                    // generate a new Id
      [FIELD.key]: plan,
      [FIELD.store]: STORE.profile,
      [FIELD.type]: 'plan',
    }

    this.dbg('plan: %j', planDoc);
    this.data.insDoc(COLLECTION.Member, planDoc)
      .then(_ => this.store.dispatch(new Navigate(['/attend'])))
      .catch(err => this.dbg('setPlan: %j', err))
  }

  checkIn(event: IClass, date?: number) {
    const attendDoc = {
      [FIELD.id]: this.data.newId,
      store: 'abc',
    }

    this.dbg('attend: %j', attendDoc);
    this.data.setDoc(COLLECTION.Attend, attendDoc)
      .then(_ => this.store.dispatch(new Navigate(['/status'])))
      .catch(err => this.dbg('checkIn: %j', err))
  }
}
