import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';

import { AngularFireModule } from 'angularfire2';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { AngularFireFunctionsModule } from 'angularfire2/functions';
import { environment } from '@env/environment';

const fb = environment.firebase || {};

@NgModule({
  imports: [
    CommonModule,
    NgxsModule.forFeature([ClientState, MemberState, AttendState]),
    AngularFireModule.initializeApp(fb.app, fb.config),
    AngularFirestoreModule.enablePersistence(),
    AngularFireFunctionsModule,
  ],
  declarations: []
})
export class DBaseModule { }
