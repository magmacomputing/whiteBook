import { Component, OnInit } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, filter } from 'rxjs/operators';

import { Select, Store } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { ClientState } from '@state/client.state';
import { IClientState, IClientDoc } from '@state/client.define';

import { FireService } from '@dbase/fire/fire.service';
import { FIELD, COLLECTION } from '@dbase/fire/fire.define';
import { IProvider } from '@func/app/app.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private dbg: Function = dbg.bind(this);
  @Select((state:any) => state[SLICE.client]['provider'])  provider$!: Observable<IProvider[]>;
  // @Select((state: any) => state.client.provider) provider$!: Observable<IProvider[]>;

  constructor(private readonly fire: FireService) {
    // this.fire.snap('provider');       // for some reason, we need to kick-start 1st-time subscribers
    // const sub = this.af              
    //   .collection<IClientDoc>(COLLECTION.Client)
    //   .valueChanges()
    //   .subscribe(snap => { sub.unsubscribe() })
  }

  ngOnInit() { 
    this.fire.snap('provider');
  }
}
