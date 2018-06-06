import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularFireAuthModule } from 'angularfire2/auth';

import { NgxsModule } from '@ngxs/store';
import { AuthState } from '@dbase/auth/auth.state';

@NgModule({
  imports: [
    CommonModule,
    NgxsModule.forFeature([AuthState]),
    AngularFireAuthModule,
  ],
  declarations: [],
})
export class AuthModule { }
