import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { RoutingModule } from '@route/routing.module';
import { AppComponent } from './app.component';
import { DBaseModule } from '@dbase/dbase.module';
import { AuthModule } from '@dbase/auth/auth.module';

import { NgxsModule } from '@ngxs/store';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';
import { NgxsRouterPluginModule } from '@ngxs/router-plugin';
import { StoreStorage } from '@dbase/sync/sync.define';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    NgxsModule.forRoot([]),
    NgxsStoragePluginModule.forRoot({ key: StoreStorage }),
    NgxsRouterPluginModule.forRoot(),
    DBaseModule,
    RoutingModule,
    AuthModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
