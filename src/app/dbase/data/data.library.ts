import { IWhere } from '@dbase/fire/fire.interface';
import { FILTER, FIELD } from '@dbase/data/data.define';
import { IStoreMeta, IMeta } from '@dbase/data/data.schema';

/** prepare a document for Inserting */
export const insPrep = async (collection: string, doc: IStoreMeta) => {
  const where: IWhere[] = [];
  const filter = FILTER[collection] || [];				// get the standard list of fields on which to filter

  if (!doc[FIELD.key] && filter.includes(FIELD.key)) {
    const user = await this.auth.user();          // get the current User's uid
    if (user.userInfo)
      doc[FIELD.key] = user.userInfo.uid;         // ensure uid is included on doc
  }

  try {
    filter.forEach(field => {
      if (doc[field])                             // if that field exists in the doc, add it to the filter
        where.push({ fieldPath: field, opStr: '==', value: doc[field] })
      else throw new Error(`missing required field: ${field}`)
    })
  } catch (err) {
    this.snack.open(err);
  }

  return where;
}

interface IUpdate {
  [FIELD.id]: string;
  [FIELD.effect]?: number;
  [FIELD.expire]?: number;
  [FIELD.create]?: number;
}

/** Expire any previous docs */
export const updPrep = (prevDocs: IStoreMeta[], tstamp: number) => {
  return Promise.all(
    prevDocs.map(async prevDoc => {             // loop through existing-docs first, to determine effect/expire range
      const prevId = prevDoc[FIELD.id];
      const updates: IUpdate = { [FIELD.id]: prevId };
      let effect = prevDoc[FIELD.effect] || 0;

      if (!effect) {                                // the _create field is currently only available from the server
        const meta = await this.getMeta(prevDoc[FIELD.store], prevId);
        effect = meta[FIELD.create];
      }

      if (tstamp < effect) {
        updates[FIELD.effect] = effect;               // set the effective-date for the existing row
        tstamp = effect;                            // set the date-boundary
      } else {
        updates[FIELD.expire] = effect;               // set the expiry-date the existing row
      }

      this.dbg('updDoc: %j', updates);
      return { updates, tstamp }
    })
  )
}