import { IMemberInfo, TProfileInfo } from '@dbase/data/data.schema';
import { asArray } from '@lib/array.library';
import { isString, isObject } from '@lib/type.library';
import { getStamp } from '@lib/date.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getProfileInfo = (list: TProfileInfo = []) =>
  asArray(list).map((info, idx) => {
    const profile = info.profile;
    return {
      provider: info.providerId,
      id: profile.id,
      firstName: profile.given_name || profile.first_name || profile.firstName,
      lastName: profile.family_name || profile.last_name || profile.lastName,
      fullName: profile.name,
      email: profile.email || profile.emailAddress,
      gender: profile.gender,
      picture: profile.pictureUrl
        || profile.thumbnail
        || isString(profile.picture) && profile.picture
        || isObject(profile.picture) && isObject(profile.picture.data) && profile.picture.data.url
        || undefined,
      birthday: profile.birthday && getStamp(profile.birthday, 'DD/MM/YYYY'),
    } as IMemberInfo
  })
