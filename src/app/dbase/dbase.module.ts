import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxsModule } from '@ngxs/store';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';
import { ClientState } from '@state/client.state';
import { StoreStorage } from '@dbase/sync/sync.define';

import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { environment } from '@env/environment';

const fb = environment.firebase || {};

@NgModule({
  imports: [
    CommonModule,
    AngularFireModule.initializeApp(fb.app, fb.config),
    AngularFireAuthModule,
    AngularFirestoreModule.enablePersistence(),
    NgxsModule.forRoot([ClientState]),
    NgxsStoragePluginModule.forRoot({ key: StoreStorage }),
  ],
  declarations: []
})
export class DBaseModule { }
