import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AuthState } from '@dbase/state/auth.state';
import { IAuthState } from '@dbase/state/auth.define';

import { IPrice, IClass, IMeta, IProfile, IProfilePlan, IDefaultPrice, IDefaultPlan } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';
import { IWhere } from '@dbase/fire/fire.interface';

import { isNumber, isUndefined } from '@lib/object.library';
import { fmtDate } from '@lib/date.library';
import { DATE_FMT } from '@lib/date.define';
import { dbg } from '@lib/logger.library';
import { filterTable } from '@dbase/app/app.library';

@Injectable({ providedIn: DBaseModule })
export class mamService {
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new'); }

  // async attend(event: string, date?: string | number) {
  //   const { plan, type, price, } = await this.getPrice('MultiStep', undefined, undefined, true);
  //   this.dbg('members on the %s plan attending a %s class pay an amount of %s on the date %s', plan, type, price, this.getDate());
  // }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  /** get current values of a store-type from state */
  private getStore<T>(store: string, selector: any, allDocs: boolean = false) {
    return this.store
      .selectOnce(selector)
      .toPromise()
      .then(state => state[store] as T[])
      .then(docs => allDocs ? docs : this.asAt(docs))
  }

  /** the current logged-on User ID */
  private getUID(uid?: string) {
    return uid
      ? Promise.resolve(uid)
      : this.store
        .selectOnce(AuthState)
        .toPromise<IAuthState>()
        .then(auth => auth.userInfo && auth.userInfo.uid || '')
  }

  /**
   * Determine what price was in effect, given the Member's Plan-type, Event-name and Date.
   * A price is determined by a Member's
   * -> 'Plan'	(which names the pricing per Event-type)
   * -> 'Event' (which names the class)
   * -> 'Date'	(because Plan-pricing changes over time)
   * @param event 	The name of the Event that was attended
   * @param uid			The uid of the Member
   * @param date 		The date to use when determining which Price-row was effective at that time
   */
  // private async getPrice(event: string, uid?: string, date?: string | number, debug?: boolean) {
  //   let where: IWhere | IWhere[];
  //   const [user_id, _default_, profile, classes, prices] = await Promise.all([
  //     this.getUID(uid),
  //     this.getStore<IDefaultPrice>('_default_', ClientState),
  //     this.getStore<IProfile>('profile', MemberState),
  //     this.getStore<IClass>('class', ClientState),
  //     this.getStore<IPrice>('price', ClientState),
  //   ])

  //   // get the Application Pricing defaults as-at the Date
  //   where = { fieldPath: 'source', opStr: '==', value: 'price' };
  //   const defaultPlan = this.asAt(_default_, where, date)[0] as IDefaultPlan;
  //   if (debug) this.dbg('defaultPrice: %j', defaultPlan);

  //   // what plan was in effect for this Member as-at the Date?
  //   where = [{ fieldPath: 'type', opStr: '==', value: 'plan' }, { fieldPath: 'uid', opStr: '==', value: user_id }];
  //   const profileRow = this.asAt(profile, where, date)[0] as IProfilePlan;
  //   const plan = profileRow && profileRow.plan || defaultPlan.plan;
  //   if (debug) this.dbg('profileRow: %j', profileRow);

  //   // what type of class pricing (eg. 'half', 'full') was in effect as-at the Date?
  //   where = { fieldPath: 'name', opStr: '==', value: event }
  //   const classRow = this.asAt(classes, where, date)[0];
  //   const type = classRow && classRow.type || defaultPrice.class;
  //   if (debug) this.dbg('classRow: %j', classRow);

  //   // what price for this plan and class-type was in effect as-at the Date?
  //   where = [{ fieldPath: 'plan', opStr: '==', value: plan }, { fieldPath: 'type', opStr: '==', value: type }];
  //   const priceRow = this.asAt(prices, where, date)[0];
  //   const price = priceRow && !isUndefined(priceRow.amount) ? priceRow.amount : defaultPrice.amount;
  //   if (debug) this.dbg('priceRow: %j', priceRow);

  //   return { plan, type, price, }
  // }

  /**
	 * Search an array, returning rows that match all the 'conditions' and were effective on the 'date'
	 * @param table		The table-array to search
	 * @param cond 		condition to use as filter
	 * @param date 		The date to use when determining which table-row was effective at that time
	 */
  private asAt<T>(table: T[], cond: IWhere | IWhere[] = [], date?: string | number) {
    const stamp = this.getDate(date);

    return filterTable<T>(table, cond)													// return the rows where date is between _effect and IMeta
      .filter((row: IMeta) => stamp < (row[FIELD.expire] || Number.MAX_SAFE_INTEGER))
      .filter((row: IMeta) => stamp >= (row[FIELD.effect] || Number.MIN_SAFE_INTEGER))
  }

  /** allow for undefined dates (ie. 'today') or defined dates */
  private getDate(date?: string | number) {
    return isNumber(date) ? date : fmtDate(date, DATE_FMT.yearMonthDayFmt).stamp;
  }
}