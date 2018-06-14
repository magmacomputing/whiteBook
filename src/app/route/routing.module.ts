import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '@app/route/material.module';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard } from '@dbase/auth/auth.guard';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/login', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forRoot(routes),],
	exports: [RouterModule,],
	declarations: [LoginComponent, AttendComponent],
})
export class RoutingModule { }
