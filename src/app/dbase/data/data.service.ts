import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { DBaseModule } from '@dbase/dbase.module';

import { take } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE } from '@dbase/state/state.define';

import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { TStoreBase, IMeta } from '@dbase/data/data.schema';
import { getWhere, updPrep, getSlice, docPrep, checkDiscard } from '@dbase/data/data.library';
import { TWhere, IQuery } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';
import { asAt } from '@dbase/app/app.library';

import { TString } from '@lib/type.library';
import { getStamp } from '@lib/date.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/**
 * The DataService is responsible for managing the syncing between
 * the local State (ngxs 'Store') and the remote DataBase (Firebase 'Cloud Firestore').  
 * The intention is that all 'reads' are from State, and all 'writes' are to a persisted
 * local cache of the Database (which FireStore will sync back to the server).
 */
@Injectable({ providedIn: DBaseModule })
export class DataService {
	private dbg = dbg(this);

	constructor(public auth: AuthService, private fire: FireService, private sync: SyncService, private store: Store, private snack: MatSnackBar) {
		this.dbg('new');
		this.sync.on(COLLECTION.client, SLICE.client);
	}

	/** Make Store data available in a Promise */
	private snap<T>(store: string) {
		const slice = getSlice(store);

		return this.store
			.selectOnce<T[]>(state => state[slice][store])
			.toPromise()
	}

	getMeta(store: string, docId: string) {
		return store
			? this.fire.callMeta(store, docId)
			: Promise.reject(`Cannot determine slice: ${store}`)
	}
	
	getDirect<T>(collection: string, query?: IQuery) {				// special: direct access to collection, rather than via state
		return this.fire.colRef<T>(collection, query)
			.valueChanges()
			.pipe(take(1))
			.toPromise()
	}

	get newId() {
		return this.fire.newId();                       				// get Firebase to generate a new Key
	}

	async setDoc(store: string, doc: TStoreBase) {
		doc = await docPrep(doc, this.auth.user)								// make sure we have a <key/uid> field
		return this.fire.setDoc(store, doc);
	}

	updDoc(store: string, docId: string, data: TStoreBase) {
		return this.fire.updDoc(store, docId, data);
	}

	log(output: any) {																				// write a /log entry

	}

	/** Expire any current matching docs, and Create new doc */
	async insDoc(nextDocs: TStoreBase, filter?: TWhere, discards: TString = []) {
		const creates: TStoreBase[] = [];
		const updates: TStoreBase[] = [];

		const promises = asArray(nextDocs).map(async nextDoc => {
			let tstamp = nextDoc[FIELD.effect] || getStamp();	    // the position in the date-range to Create
			let where: TWhere;

			try {
				nextDoc = await docPrep(nextDoc, this.auth.user)		// make sure we have a <key/uid>
				where = getWhere(nextDoc as IMeta, filter);
			} catch (error) {
				this.snack.open(error.message);                     // show the error to the User
				return;                                             // abort the Create/Update
			}

			const currDocs = await this.snap<TStoreBase>(nextDoc[FIELD.store])// read the store
				.then(table => asAt(table, where, tstamp))          // find where to create new doc (generally one-prevDoc expected)
				.then(table => updPrep(table, tstamp, this.fire))   // prepare the update's <effect>/<expire>

			if (currDocs.updates.length) {
				if (currDocs.stamp > 0)															// if the stamp is positive,
					nextDoc[FIELD.effect] = currDocs.stamp;           // updPrep has changed the <effect>,
				else nextDoc[FIELD.expire] = -currDocs.stamp;       // otherwise back-date the nextDoc's <expire>
			}

			if (!checkDiscard(discards, nextDoc, currDocs.data)) {// only if currDoc is different from nextDoc...
				creates.push(nextDoc);                              // push the prepared document-create
				updates.push(...currDocs.updates);                  // push the associated document-updates
			}
		})

		await Promise.all(promises);                            // collect all the Creates/Updates/Deletes
		return this.batch(creates, updates);                    // then apply writes in a Batch
	}

	/** Batch a series of writes */
	batch(creates?: TStoreBase[], updates?: TStoreBase[], deletes?: TStoreBase[]) {
		return this.fire.batch(creates, updates, deletes);
	}
}