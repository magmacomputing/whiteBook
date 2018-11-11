import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireFunctionsModule } from '@angular/fire/functions';
import { environment } from '@env/environment';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';

const fb = environment.firebase || {};

@NgModule({
	imports: [
		CommonModule,
		NgxsModule.forFeature([ClientState, MemberState, AttendState]),
		AngularFireModule.initializeApp(fb.app, fb.config),
		AngularFirestoreModule.enablePersistence({ experimentalTabSynchronization: true }),
		AngularFireFunctionsModule,
	],
	declarations: []
})
export class DBaseModule { }
