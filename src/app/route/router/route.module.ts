import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { ROUTE } from '@route/router/route.define';
import { ProfileGuard, DeactivateGuard, OAuthGuard, LoginGuard, AdminGuard } from '@route/router/route.guard';

import { MaterialModule } from '@service/material/material.module';
import { LoginComponent } from '@route/login/login.component';
import { AttendComponent } from '@route/attend/attend.component';
import { OAuthComponent } from '@route/login/oauth.component';

const routes: Routes = [
	{ path: ROUTE.OAuth, component: OAuthComponent, canActivate: [OAuthGuard], canDeactivate: [DeactivateGuard] },		// TODO: cannot be lazy-loaded
	{ path: ROUTE.Login, component: LoginComponent, canActivate: [LoginGuard] },
	{ path: ROUTE.Attend, component: AttendComponent, canActivate: [ProfileGuard] },
	{ path: ROUTE.Profile, loadChildren: () => import('@route/profile/profile.module').then(m => m.ProfileModule), canActivate: [LoginGuard] },
	{ path: ROUTE.About, loadChildren: () => import('@route/about/about.module').then(m => m.AboutModule) },

	{ path: ROUTE.Zoom, loadChildren: () => import('@route/zoom/zoom.module').then(m => m.ZoomModule), canActivate: [LoginGuard] },
	{ path: ROUTE.Admin, loadChildren: () => import('@route/admin/admin.module').then(m => m.AdminModule), canActivate: [AdminGuard] },
	{ path: ROUTE.Forum, loadChildren: () => import('@route/forum/forum.module').then(m => m.ForumModule), canActivate: [ProfileGuard] },
	{ path: ROUTE.Migrate, loadChildren: () => import('@route/migrate/migrate.module').then(m => m.MigrateModule), canActivate: [AdminGuard] },

	{ path: '**', redirectTo: ROUTE.Attend, pathMatch: 'full' },
]

@NgModule({
	imports: [CommonModule, MaterialModule, HttpClientModule, RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' }),],
	exports: [RouterModule],
	declarations: [LoginComponent, AttendComponent, OAuthComponent],
	providers: [DeactivateGuard, OAuthGuard],
})
export class RoutingModule { }
