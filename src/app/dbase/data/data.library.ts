import { IAuthState } from '@dbase/state/auth.define';
import { FireService } from '@dbase/fire/fire.service';
import { IWhere } from '@dbase/fire/fire.interface';

import { IStoreMeta, IStoreBase } from '@dbase/data/data.schema';
import { FILTER, FIELD, STORES } from '@dbase/data/data.define';
import { asArray } from '@lib/object.library';

export const getSlice = (store: string) => {    // determine the state-slice (collection) based on the <store> field
  return Object.keys(STORES)
    .filter(col => STORES[col].includes(store))[0]
    || 'attend'                                 // TODO: is it safe to assume <attend> if unknown 'store'?
}

/** prepare a where-clause to use when identifying existing documents that will clash with nextDoc */
export const getWhere = (nextDoc: IStoreMeta, filter: IWhere | IWhere[] = []) => {
  const where: IWhere[] = [];
  const collection = getSlice(nextDoc[FIELD.store]);
  const filters = FILTER[collection] || [];			// get the standard list of fields on which to filter

  filters.forEach(field => {
    if (nextDoc[field])                         // if that field exists in the doc, add it to the filter
      where.push({ fieldPath: field, value: nextDoc[field] })
    else throw new Error(`missing required field: ${field}`)
  })

  asArray(filter).forEach(clause => {           // add any additional match-criteria
    if (nextDoc[clause.fieldPath as string])
      where.push({ fieldPath: clause.fieldPath, value: clause.value })
  })

  return where;
}

export const docPrep = (doc: IStoreBase, auth: IAuthState) => {
  const collection = getSlice(doc[FIELD.store]);
  const filters = FILTER[collection] || [];			// get the standard list of fields on which to filter

  if (!doc[FIELD.key] && filters.includes(FIELD.key) && auth && auth.userInfo)
    doc[FIELD.key] = auth.userInfo.uid;         // ensure uid is included on doc
  return doc;
}

/** Expire current docs */
export const updPrep = async (currDocs: IStoreMeta[], tstamp: number, fire: FireService) => {
  let stamp = tstamp;                           // stash the tstamp
  const updates = await Promise.all(
    currDocs.map(async currDoc => {             // loop through existing-docs first, to determine currEffect/currExpire range
      const currStore = currDoc[FIELD.store];
      const currUpdate: IStoreBase = { [FIELD.id]: currDoc[FIELD.id], [FIELD.store]: currStore };;
      const currExpire = currDoc[FIELD.expire];
      let currEffect = currDoc[FIELD.effect];

      if (!currEffect) {                        // _create is only available from server
        currEffect = await fire.getMeta(currStore, currDoc[FIELD.id])
          .then(meta => meta[FIELD.create] || Number.MIN_SAFE_INTEGER);
      }

      switch (true) {
        case tstamp === currEffect:             // anomaly; do nothing?
          break;

        case tstamp > currEffect:               // expire current Doc
          if (currExpire)                       // very rare
            stamp = -currExpire;                // adjust new Doc's expiry
          currUpdate[FIELD.expire] = tstamp;
          break;

        case tstamp < currEffect:               // back-date a Document
          currUpdate[FIELD.effect] = currEffect; // ensure current Doc is effective
          stamp = -currEffect;                  // adjust new Doc's expiry
          break;
      }

      return currUpdate;
    })
  )

  return { updates, stamp };                    // include the tstamp, in case it was changed
}