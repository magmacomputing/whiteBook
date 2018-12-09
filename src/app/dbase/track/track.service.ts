import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { AuthService } from '@dbase/auth/auth.service';

import { STORE, FIELD } from '@dbase/data/data.define';
import { ETrack, ITrack } from '@dbase/track/track.define';

import { getStamp, fmtDate, DATE_KEY } from '@lib/date.library';
import { getPath } from '@lib/object.library';
import { sprintf } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class TrackService {
  private logLevel = ETrack.all;

  constructor(private fire: FireService, private auth: AuthService) { }

  async write(fmt?: any, ...data: any[]) {
    const stamp = getStamp();
    const [day, month, year] = fmtDate(stamp, DATE_KEY.dayMonthYear)
      .toString()
      .split('/')
      .map(Number);

    const uid = await this.auth.user
      .then(user => getPath<string>(user, 'auth.user.uid'))
    
    const trackDoc: ITrack = {
      [FIELD.store]: STORE.log,
      [FIELD.type]: this.logLevel,
      [FIELD.uid]: uid,
      stamp: stamp,
      date: { year, month, day},
      msg: sprintf(data),
    }

    this.fire.setDoc(STORE.log, trackDoc);
    console.log(JSON.stringify(trackDoc));
  }

  set level(level: ETrack) {
    this.logLevel = level;
  }

  get level() {
    return this.logLevel;
  }
}
