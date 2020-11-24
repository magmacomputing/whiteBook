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

import { auth } from '@dbase/data.define';
import { getPath } from '@library/object.library';

const toLogin = () => redirectUnauthorizedTo([ROUTE.Login]);
const toAttend = () => redirectLoggedInTo([ROUTE.Attend, ROUTE.Zoom]);
const isAdmin = () => pipe(customClaims, map(custom => getPath<string[]>(custom, 'customClaims.roles', [])!.includes(auth.ROLE.Admin)));

const routes: Routes = [
	{ path: ROUTE.OAuth, component: OAuthComponent, canActivate: [OAuthGuard], canDeactivate: [DeactivateGuard] },		// TODO: cannot be lazy-loaded
	{ path: ROUTE.Login, component: LoginComponent},//, canActivate: [AngularFireAuthGuard], data: { authGuardPipe: toAttend } },
	{ path: ROUTE.Attend, component: AttendComponent, canActivate: [ProfileGuard], data: { authGuardPipe: toLogin } },
	{ path: ROUTE.Profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [AngularFireAuthGuard] },
	{ path: ROUTE.About, loadChildren: () => import('@route/about/about.module').then(m => m.AboutModule) },

	{ path: ROUTE.Zoom, loadChildren: () => import('@route/zoom/zoom.module').then(m => m.ZoomModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.Admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.Forum, loadChildren: () => import('@route/forum/forum.module').then(m => m.ForumModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },
	{ path: ROUTE.Migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), canActivate: [AngularFireAuthGuard], data: { authGuardPipe: isAdmin } },

	{ path: '**', redirectTo: ROUTE.Attend, pathMatch: 'full' },
]

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, AngularFireAuthGuardModule, RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' }),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
	providers: [AngularFireAuthGuard, DeactivateGuard, OAuthGuard],
})
export class RoutingModule { }
