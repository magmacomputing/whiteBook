import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '@app/route/material.module';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard, ProfileGuard } from '@route/routing.guard';

import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { ProfileComponent } from '@route/profile/profile.component';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/login', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forRoot(routes),],
	exports: [RouterModule,],
	declarations: [LoginComponent, AttendComponent, ProfileComponent],
})
export class RoutingModule { }
