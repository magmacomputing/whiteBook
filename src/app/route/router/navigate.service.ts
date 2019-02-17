import { Injectable, NgZone } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

import { createPromise } from '@lib/utility.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class NavigateService {
  private dbg = dbg(this);

  constructor(private router: Router, private zone: NgZone) { this.dbg('new') }

  route(url: string | UrlTree) {
    this.dbg('route: /%s', url);

    return new Promise<boolean>((resolve, reject) =>
      this.zone.run(_ =>
        this.router.navigateByUrl(url)
          .then(res => resolve(res))
          .catch(err => reject(err))
      )
    )
  }
}