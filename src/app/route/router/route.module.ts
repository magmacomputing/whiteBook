import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireAuthGuardModule, AngularFireAuthGuard, customClaims, canActivate } from '@angular/fire/auth-guard';

import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';

import { ROUTE } from '@route/route.define';
import { ProfileGuard, DeactivateGuard } from '@route/route.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';

const admin = pipe(customClaims, map(claims => claims.roles && claims.roles.includes('admin')));

const routes: Routes = [
	{ path: ROUTE.oauth, component: OAuthComponent, canDeactivate: [DeactivateGuard] },				// todo: cannot be lazy-loaded
	{ path: ROUTE.login, component: LoginComponent },
	{ path: ROUTE.attend, component: AttendComponent, canActivate: [AngularFireAuthGuard, ProfileGuard] },
	{ path: ROUTE.profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AngularFireAuthGuard] },
	{ path: ROUTE.admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), ...canActivate(admin) },
	{ path: ROUTE.migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), ...canActivate(admin) },
	{ path: '**', redirectTo: '/attend', pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, AngularFireAuthGuardModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
})
export class RoutingModule { }
