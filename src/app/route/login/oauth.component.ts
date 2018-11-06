import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { AuthService } from '@dbase/auth/auth.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-oauth',
  templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit {
  private dbg: Function = dbg.bind(this);

  constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService) {
    this.dbg('route: %j', route.snapshot.url);
   }

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    this.dbg('code: %s', code);

    if (code) {
      const urlAccess = 'https://us-central1-whitefire-dev.cloudfunctions.net/authAccess';

      this.http.post<any>(urlAccess, {}).pipe(
        tap(res => this.dbg('result: %j', res)),
        switchMap(res => from(this.auth.signInToken(res.authToken))),
      )
    }
  }
}
