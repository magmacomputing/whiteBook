import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { AuthGuard, ProfileGuard, DeactivateGuard } from '@route/routing.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'attend', component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: 'profile', loadChildren: '@route/profile/profile.module#ProfileModule', canActivate: [AuthGuard] },
	{ path: 'login/oauth', loadChildren: '@route/login/oauth.module#OAuthModule' , canDeactivate: [DeactivateGuard]},
	{ path: 'admin', loadChildren: '@route/admin/admin.module#AdminModule', canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent],
})
export class RoutingModule { }
