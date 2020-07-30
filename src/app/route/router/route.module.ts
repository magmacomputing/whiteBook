import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AngularFireAuthGuardModule, AngularFireAuthGuard, customClaims, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';

import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';

import { ROUTE } from '@route/router/route.define';
import { ProfileGuard, DeactivateGuard, OAuthGuard } from '@route/router/route.guard';
import { MaterialModule } from '@service/material/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';
import { EMailComponent } from '@route/login/email.component';

import { Auth } from '@dbase/data/data.define';
import { getPath } from '@library/object.library';

const toLogin = () => redirectUnauthorizedTo([ROUTE.login]);
const toAttend = () => redirectLoggedInTo([ROUTE.zoom, ROUTE.attend]);
const isAdmin = () => pipe(customClaims, map(custom => getPath<string[]>(custom, 'claims.roles', [])!.includes(Auth.ROLE.admin)));

const routes: Routes = [
	{ path: ROUTE.oauth, component: OAuthComponent, canActivate: [OAuthGuard], canDeactivate: [DeactivateGuard] },		// TODO: cannot be lazy-loaded
	{ path: ROUTE.login, component: LoginComponent, canActivate: [AngularFireAuthGuard], data: { authGuardPipe: toAttend } },
	{ path: ROUTE.attend, component: AttendComponent, canActivate: [ProfileGuard], data: { authGuardPipe: toLogin } },
	{ path: ROUTE.profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AngularFireAuthGuard] },
	{ path: ROUTE.about, loadChildren: () => import('@route/about/about.module').then(m => m.AboutModule) },

	{ path: ROUTE.zoom, loadChildren: () => import('@route/zoom/zoom.module').then(m => m.ZoomModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.forum, loadChildren: () => import('@route/forum/forum.module').then(m => m.ForumModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },

	{ path: '**', redirectTo: ROUTE.zoom, pathMatch: 'full' },
];

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, AngularFireAuthGuardModule, RouterModule.forRoot(routes),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
	providers: [AngularFireAuthGuard, DeactivateGuard, OAuthGuard],
})
export class RoutingModule { }
