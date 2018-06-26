import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { isUndefined } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * This internal service will communicate with the FireStore database,
 * (via the DataService)
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly af: AngularFirestore) {
		this.dbg('new');
	}

	ref(store: string, docId?: string) {
		return isUndefined(docId)
			? this.af.firestore.collection(store).doc()
			: this.af.firestore.collection(store).doc(docId)
	}

	bat() {
		return this.af.firestore.batch();
	}
}