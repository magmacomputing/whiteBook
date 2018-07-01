import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { AuthGuard, ProfileGuard } from '@route/routing.guard';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: 'profile', loadChildren: '@route/profile/profile.module#ProfileModule' },
	{ path: 'admin', loadChildren: '@route/admin/admin.module#AdminModule' },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forRoot(routes),],
	exports: [RouterModule,],
	declarations: [LoginComponent, AttendComponent],
})
export class RoutingModule { }
