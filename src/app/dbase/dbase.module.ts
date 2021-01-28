import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxsModule } from '@ngxs/store';

import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';
import { AdminState } from '@dbase/state/admin.state';

import { InfoSnackBar, WarnSnackBar, ErrorSnackBar } from '@service/material/snack.service';

@NgModule({
	imports: [
		CommonModule,
		NgxsModule.forFeature([ClientState, MemberState, AttendState, AdminState]),
	],
	declarations: [
		InfoSnackBar,
		WarnSnackBar,
		ErrorSnackBar
	],
})
export class DBaseModule { }
