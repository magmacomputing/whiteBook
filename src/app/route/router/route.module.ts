import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireAuthGuardModule, AngularFireAuthGuard, customClaims, canActivate, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';

import { pipe } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ROUTE } from '@route/route.define';
import { ProfileGuard, DeactivateGuard } from '@route/route.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';

import { getPath } from '@lib/object.library';

const isAdmin = pipe(customClaims,
	map(custom => getPath<string[]>(custom, 'claims.roles', [])!.includes('admin')),
);
const toLogin = redirectUnauthorizedTo([ROUTE.login]);																			// TODO: remove navigate from AuthState
const toAttend = redirectLoggedInTo([ROUTE.attend]);																				// TODO: add to ROUTE.login

const routes: Routes = [
	{ path: ROUTE.oauth, component: OAuthComponent, canDeactivate: [DeactivateGuard] },				// TODO: cannot be lazy-loaded
	{ path: ROUTE.login, component: LoginComponent },
	{ path: ROUTE.attend, component: AttendComponent, canActivate: [AngularFireAuthGuard, ProfileGuard] },
	{ path: ROUTE.profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AngularFireAuthGuard] },
	{ path: ROUTE.admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), ...canActivate(isAdmin) },
	{ path: ROUTE.migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), ...canActivate(isAdmin) },
	{ path: '**', redirectTo: ROUTE.attend, pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, AngularFireAuthGuardModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
})
export class RoutingModule { }
