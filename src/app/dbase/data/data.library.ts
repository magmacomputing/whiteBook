import { IWhere } from '@dbase/fire/fire.interface';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreMeta, IMeta, IStoreBase } from '@dbase/data/data.schema';
import { FILTER, FIELD, STORES } from '@dbase/data/data.define';
import { FireService } from '@dbase/fire/fire.service';

export const getSlice = (store: string) => {       // determine the slice based on the 'store' field
  return Object.keys(STORES)
    .filter(col => STORES[col].includes(store))[0];
}

/** prepare a where-clause to use when identifying existing documents that will clash with newDoc */
export const getWhere = async (newDoc: IStoreMeta, auth: IAuthState) => {
  const where: IWhere[] = [];
  const collection = getSlice(newDoc[FIELD.store]);
  const filter = FILTER[collection] || [];				// get the standard list of fields on which to filter

  if (!newDoc[FIELD.key] && auth && auth.userInfo)
    newDoc[FIELD.key] = auth.userInfo.uid;        // ensure uid is included on doc

  filter.forEach(field => {
    if (newDoc[field])                          // if that field exists in the doc, add it to the filter
      where.push({ fieldPath: field, value: newDoc[field] })
    else throw new Error(`missing required field: ${field}`)
  })

  return where;
}

/** Expire current docs */
export const updPrep = async (currDocs: IStoreMeta[], tstamp: number, fire: FireService) => {
  let stamp = tstamp;                           // stash the tstamp
  const updates = await Promise.all(
    currDocs.map(async currDoc => {             // loop through existing-docs first, to determine currEffect/currExpire range
      const currExpire = currDoc[FIELD.expire];
      const currEffect = currDoc[FIELD.effect] || (await fire.getMeta(
        getSlice(currDoc[FIELD.store]),         // _create is available from server
        currDoc[FIELD.id]
      ))[FIELD.create] || Number.MIN_SAFE_INTEGER

      switch (true) {
        case tstamp === currEffect:             // anomoly, do nothing
          break;

        case tstamp > currEffect:               // expire current Doc
          if (currExpire)                       // very rare
            stamp = -currExpire;                // adjust new Doc's expiry
          currDoc[FIELD.expire] = tstamp;
          break;

        case tstamp < currEffect:               // back-date a Document
          currDoc[FIELD.effect] = currEffect;   // ensure current Doc is effective
          stamp = -currEffect;                  // adjust new Doc's expiry
          break;
      }

      return currDoc;
    })
  )

  return { updates, stamp };                    // include the tstamp, in case it was changed
}