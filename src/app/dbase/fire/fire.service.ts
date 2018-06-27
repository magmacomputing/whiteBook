import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { IQuery } from '@dbase/fire/fire.interface';
import { fnQuery } from '@dbase/fire/fire.library';

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

	/** Collection Reference, with option query */
	colRef(store: string, query?: IQuery) {
		return this.af.collection(store, fnQuery(query));
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		return isUndefined(docId)
			? this.af.firestore.collection(store).doc()
			: this.af.firestore.collection(store).doc(docId)
	}

	newId() {
		return this.af.createId();
	}

	/** Instantiate a new WriteBatch */
	bat() {
		return this.af.firestore.batch();
	}


}