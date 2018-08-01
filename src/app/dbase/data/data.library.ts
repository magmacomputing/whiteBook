import { IWhere } from '@dbase/fire/fire.interface';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreMeta, IMeta, IStoreBase } from '@dbase/data/data.schema';
import { FILTER, FIELD, STORES } from '@dbase/data/data.define';

export const getSlice = (store: string) => {       // determine the slice based on the 'store' field
  return Object.keys(STORES)
    .filter(col => STORES[col].includes(store))[0];
}

/** prepare a where-clause to use when identifying existing documents that will clash with newDoc */
export const insPrep = async (newDoc: IStoreMeta, auth: IAuthState) => {
  const where: IWhere[] = [];
  const collection = getSlice(newDoc[FIELD.store]);
  const filter = FILTER[collection] || [];				// get the standard list of fields on which to filter

  if (!newDoc[FIELD.key] && filter.includes(FIELD.key)) {
    if (auth.userInfo)
      newDoc[FIELD.key] = auth.userInfo.uid;      // ensure uid is included on doc
  }

  filter.forEach(field => {
    if (newDoc[field])                          // if that field exists in the doc, add it to the filter
      where.push({ fieldPath: field, opStr: '==', value: newDoc[field] })
    else throw new Error(`missing required field: ${field}`)
  })

  return where;
}

/** Expire any previous docs */
export const updPrep = (prevDocs: IStoreMeta[], tstamp: number) => {
  return Promise.all(
    prevDocs.map(async prevDoc => {             // loop through existing-docs first, to determine effect/expire range
      const prevId = prevDoc[FIELD.id];
      const updates: IStoreMeta = prevDoc;
      let effect = prevDoc[FIELD.effect] || 0;

      if (!effect) {                                // the _create field is currently only available from the server
        const meta = await this.getMeta(prevDoc[FIELD.store], prevId);
        effect = meta[FIELD.create];
      }

      if (tstamp < effect) {
        updates[FIELD.effect] = effect;             // set the effective-date for the existing row
        tstamp = effect;                            // set the date-boundary
      } else {
        updates[FIELD.expire] = effect;             // set the expiry-date the existing row
      }

      this.dbg('updDoc: %j', updates);
      return { updates, tstamp }
    })
  )
}