import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxsModule } from '@ngxs/store';
import { AuthState } from '@dbase/state/auth.state';

@NgModule({
	imports: [
		CommonModule,
		NgxsModule.forFeature([AuthState]),
	],
	declarations: [],
})
export class AuthModule { }
