import { Injectable } from '@angular/core';
import { ELog } from './trace.define';

@Injectable({ providedIn: 'root' })
export class TraceService {
  private logLevel = ELog.All;

  constructor() { }

  log(msg: any) {
    console.log(JSON.stringify(msg));
  }
}
