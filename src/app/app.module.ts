import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { RoutingModule } from '@route/routing.module';
import { DBaseModule } from '@dbase/dbase.module';
import { AuthModule } from '@dbase/auth/auth.module';
import { AppComponent } from './app.component';

import { NgxsModule } from '@ngxs/store';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';
import { NgxsRouterPluginModule } from '@ngxs/router-plugin';
import { StoreStorage } from '@dbase/sync/sync.define';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    NgxsModule.forRoot([]),
    NgxsStoragePluginModule.forRoot({ key: StoreStorage }),
    NgxsRouterPluginModule.forRoot(),
    BrowserModule,
    BrowserAnimationsModule,
    DBaseModule,
    RoutingModule,
    AuthModule,
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
