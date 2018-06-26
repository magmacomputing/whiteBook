import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@state/client.state';
import { MemberState } from '@state/member.state';
import { AttendState } from '@state/attend.state';

import { AuthModule } from '@dbase/auth/auth.module';
import { AngularFireModule } from 'angularfire2';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { environment } from '@env/environment';

const fb = environment.firebase || {};

@NgModule({
  imports: [
    CommonModule,
    NgxsModule.forFeature([ClientState, MemberState, AttendState]),
    AngularFireModule.initializeApp(fb.app, fb.config),
    AngularFirestoreModule.enablePersistence(),
    // AuthModule,
  ],
  declarations: []
})
export class DBaseModule { }
