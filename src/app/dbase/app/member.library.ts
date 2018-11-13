import { AdditionalUserInfo } from '@firebase/auth-types';
import { IMemberInfo } from '@dbase/data/data.schema';
import { isString, isObject, isNumber } from '@lib/type.library';
import { getStamp, getDateDiff } from '@lib/date.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (info: AdditionalUserInfo) => {
	const profile: { [key: string]: any; } = info.profile || {};
	return {
		providerId: info.providerId,
		providerUid: profile.id || profile.login,
		firstName: profile.given_name || profile.first_name || profile.firstName,
		lastName: profile.family_name || profile.last_name || profile.lastName,
		displayName: profile.name || profile.login
			|| (profile.given_name || profile.first_name || profile.firstName) + ' ' + (profile.family_name || profile.last_name || profile.lastName),
		email: profile.email || profile.emailAddress,
		gender: profile.gender,
		photoURL: profile.pictureUrl
			|| profile.thumbnail									// linkedin
			|| profile.avatar_url									// github
			|| isString(profile.picture) && profile.picture
			|| isObject(profile.picture) && isObject(profile.picture.data) && profile.picture.data.url
			|| undefined,
		birthday: profile.birthday && getStamp(profile.birthday),
	} as IMemberInfo
}

// each Provider might report a different birthday; take latest
export const getMemberBirthday = (info: IMemberInfo[] = []) =>
	Math.max(...info
		.map(row => row.birthday)
		.filter(isNumber))

export const getMemberAge = (info?: IMemberInfo[]) =>
	getDateDiff(getMemberBirthday(info));
