import { IWhere } from '@dbase/fire/fire.interface';
import { FILTER, FIELD } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.interface';

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