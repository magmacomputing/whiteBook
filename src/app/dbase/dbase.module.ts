import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule, FirestoreSettingsToken } from '@angular/fire/firestore';
import { AngularFireFunctionsModule, FunctionsRegionToken } from '@angular/fire/functions';
import { environment } from '@env/environment';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';
import { DeviceState } from '@dbase/state/device.state';
import { AdminState } from '@dbase/state/admin.state';

import { InfoSnackbarComponent, WarnSnackbarComponent, ErrorSnackbarComponent } from '@service/material/snack.service';

const fb = environment.firebase || {};

@NgModule({
	imports: [
		CommonModule,
		NgxsModule.forFeature([ClientState, MemberState, AttendState, DeviceState, AdminState]),
		AngularFireModule.initializeApp(fb.app, fb.config),
		AngularFirestoreModule.enablePersistence({ synchronizeTabs: true }),
		AngularFireFunctionsModule,
	],
	providers: [
		{ provide: FunctionsRegionToken, useValue: 'us-central1' },
		{ provide: FirestoreSettingsToken, useValue: {} },				// TODO: is this still necessary after @angular/fire is upgraded from 5.1.1
	],
	declarations: [InfoSnackbarComponent, WarnSnackbarComponent, ErrorSnackbarComponent],
})
export class DBaseModule { }
