import { Injectable, NgZone } from '@angular/core';
import { Router, UrlTree, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class NavigateService {
  private dbg = dbg(this);
  // private prevUrl: string | null = null;
  // private currUrl: string | null = null;

  constructor(private router: Router, private zone: NgZone) {
    this.dbg('new');
    // this.currUrl = this.router.url;
    // this.router.events
    //   .pipe(filter(event => event instanceof NavigationEnd))
    //   .subscribe(event => {
    //     if (event instanceof NavigationEnd) {
    //       this.prevUrl = this.currUrl;
    //       this.currUrl = event.url;
    //     }
    //   })
  }

  route(url: string | UrlTree) {
    this.dbg('route: /%s', url);
    // this.dbg('urls: %j', this.url);

    return new Promise<boolean>((resolve, reject) =>
      this.zone.run(_ =>
        this.router.navigateByUrl(url)
          .then(res => resolve(res))
          .catch(err => reject(err))
      )
    )
  }

  get url() {
    return this.router.url;
  }
  // get urls(): [string | null, string | null] {
  //   return [this.prevUrl, this.currUrl];
  // }
}