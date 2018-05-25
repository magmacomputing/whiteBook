import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import {dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AuthService {
  private dbg: Function = dbg.bind(this);

  constructor() { }
}
