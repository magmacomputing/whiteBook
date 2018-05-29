import { Injectable } from '@angular/core';
import { AuthModule } from '@dbase/auth/auth.module';

import {dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
  private dbg: Function = dbg.bind(this);

  constructor() {
    this.dbg('new');
   }
}
