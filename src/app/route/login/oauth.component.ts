import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { from, Subscription } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { AuthService } from '@dbase/auth/auth.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-oauth',
  templateUrl: './oauth.component.html',
})
export class OAuthComponent implements OnInit, OnDestroy {
  private dbg: Function = dbg.bind(this);
  private sub!: Subscription;
  public code!: string;
  public state!: string;

  constructor(private http: HttpClient, private route: ActivatedRoute, private auth: AuthService) {
    this.dbg('route: %j', route.snapshot.url);
  }

  ngOnInit() {
    const { code, state } = this.route.snapshot.queryParams;
    this.code = code;                           // for debug on page
    this.state = state;
    this.dbg('params: %j', this.route.snapshot.queryParams);

    if (this.code) {
      const urlAccess = 'https://us-central1-whitefire-dev.cloudfunctions.net/authAccess';
      const url = `${urlAccess}?prefix=li&code=${this.code}&state=${this.state}`;
      this.dbg('url: %s', url);

      this.sub = this.http.post<any>(url, {}).pipe(
        tap(res => this.dbg('result: %j', res)),
        switchMap(res => from(this.auth.signInToken(res.token))),
      )
        .subscribe(
					token => this.dbg('token: %j', token),
					error => this.dbg('error: %j', error),
					);
    }
  }

  ngOnDestroy() {
    this.sub && this.sub.unsubscribe();
  }
}
