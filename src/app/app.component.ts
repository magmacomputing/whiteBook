import { Component } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { AuthService } from '@dbase/auth/auth.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private readonly data: DataService, private readonly store: Store, private readonly auth: AuthService) { }

  navigate(url: string) {
    this.store.dispatch(new Navigate([url]));
  }
}
