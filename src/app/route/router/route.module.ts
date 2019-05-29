import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { ROUTE } from '@route/route.define';
import { AuthGuard, ProfileGuard, DeactivateGuard } from '@route/route.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';

const routes: Routes = [
	{ path: ROUTE.oauth, component: OAuthComponent, canDeactivate: [DeactivateGuard] },				// todo: cannot be lazy-loaded
	{ path: ROUTE.login, component: LoginComponent },
	{ path: ROUTE.attend, component: AttendComponent, canActivate: [AuthGuard, ProfileGuard] },
	{ path: ROUTE.profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AuthGuard] },
	{ path: ROUTE.admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), canActivate: [AuthGuard] },
	{ path: ROUTE.migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), canActivate: [AuthGuard] },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
})
export class RoutingModule { }
