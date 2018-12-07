import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { dbg } from '@lib/logger.library';

@Injectable({
  providedIn: 'root'
})
export class NavigateService {
  private dbg = dbg(this);

  constructor(private router: Router, private zone: NgZone) { this.dbg('new') }

  route(url: string) {
    this.zone.run(() => this.router.navigateByUrl(url));
  }
}
