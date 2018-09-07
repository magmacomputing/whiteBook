import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularFireAuthModule } from '@angular/fire/auth';

import { NgxsModule } from '@ngxs/store';
import { AuthState } from '@dbase/state/auth.state';

@NgModule({
  imports: [
    CommonModule,
    NgxsModule.forFeature([AuthState]),
    AngularFireAuthModule,
  ],
  declarations: [],
})
export class AuthModule { }
