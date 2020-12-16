import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireFunctionsModule, REGION } from '@angular/fire/functions';
import { environment } from '@env/environment';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';
import { AdminState } from '@dbase/state/admin.state';
import { StageState } from '@dbase/state/stage.state';

import { InfoSnackBar, WarnSnackBar, ErrorSnackBar } from '@service/material/snack.service';

const fire = environment.firebase || {};

@NgModule({
	imports: [
		CommonModule,
		NgxsModule.forFeature([ClientState, MemberState, AttendState, AdminState, StageState]),
		AngularFireModule.initializeApp(fire.prod, fire.config),
		AngularFirestoreModule.enablePersistence({ synchronizeTabs: true }),
		AngularFireFunctionsModule,
	],
	providers: [
		{ provide: REGION, useValue: fire.config.region },
	],
	declarations: [InfoSnackBar, WarnSnackBar, ErrorSnackBar],
})
export class DBaseModule { }
