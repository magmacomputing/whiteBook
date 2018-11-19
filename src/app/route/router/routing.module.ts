import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { AuthGuard, ProfileGuard } from '@route/routing.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';

const routes: Routes = [
	{ path: 'login/oauth', component: OAuthComponent },
	{ path: 'login', component: LoginComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: 'profile', loadChildren: '@route/profile/profile.module#ProfileModule', canActivate: [AuthGuard] },
	{ path: 'admin', loadChildren: '@route/admin/admin.module#AdminModule', canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
})
export class RoutingModule { }
