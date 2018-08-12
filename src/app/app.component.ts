import { Component } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { AuthService } from '@dbase/auth/auth.service';
import { MemberService } from '@dbase/app/member.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private readonly data: DataService, private readonly store: Store,
    private readonly auth: AuthService, private readonly member: MemberService) { }

  navigate(url: string) {
    this.store.dispatch(new Navigate([url]));
  }
}
