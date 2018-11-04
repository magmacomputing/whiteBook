import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard, ProfileGuard } from '@route/routing.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { OAuthComponent } from '@route/login/oauth.component';
import { AttendComponent } from '@route/attend/attend.component';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'login/oauth', component: OAuthComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: 'profile', loadChildren: '@route/profile/profile.module#ProfileModule', canActivate: [AuthGuard] },
	{ path: 'admin', loadChildren: '@route/admin/admin.module#AdminModule', canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, OAuthComponent, AttendComponent,],
})
export class RoutingModule { }
