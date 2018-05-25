import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { IClientState } from '@app/state/client.state';

import { IProvider } from '@func/app/app.interface';
import { FireService } from '@dbase/fire/fire.service';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  @Select((state: IClientState) => state.provider) providers!: Observable<IProvider[]>;

  constructor(public readonly fire: FireService) { }

  ngOnInit() { }

}
