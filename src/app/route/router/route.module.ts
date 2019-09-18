import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireAuthGuardModule, AngularFireAuthGuard, customClaims, canActivate, redirectUnauthorizedTo, redirectLoggedInTo, } from '@angular/fire/auth-guard';

import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';

import { ROUTE } from '@route/route.define';
import { ProfileGuard, DeactivateGuard, OAuthGuard } from '@route/route.guard';
import { MaterialModule } from '@route/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';
import { EMailComponent } from '@route/login/email.component';

import { Auth } from '@dbase/data/data.define';
import { getPath } from '@lib/object.library';

const toLogin = redirectUnauthorizedTo([ROUTE.login]);
const toAttend = redirectLoggedInTo([ROUTE.attend]);
const isAdmin = pipe(customClaims,
	map(custom => getPath<string[]>(custom, 'claims.roles', [])!.includes(Auth.ROLE.admin)),
);

const routes: Routes = [
	{ path: ROUTE.oauth, component: OAuthComponent, canActivate: [OAuthGuard], canDeactivate: [DeactivateGuard] },		// TODO: cannot be lazy-loaded
	{ path: ROUTE.login, component: LoginComponent, ...canActivate(toAttend) },
	{ path: ROUTE.attend, component: AttendComponent, ...canActivate(toLogin), canActivate: [ProfileGuard] },
	{ path: ROUTE.profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AngularFireAuthGuard] },
	{ path: ROUTE.admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), ...canActivate(isAdmin) },
	{ path: ROUTE.migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), ...canActivate(isAdmin) },
	{ path: '**', redirectTo: ROUTE.attend, pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, AngularFireAuthGuardModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent, EMailComponent],
	providers: [AngularFireAuthGuard, DeactivateGuard, OAuthGuard],
})
export class RoutingModule { }
