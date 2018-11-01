import { AdditionalUserInfo } from '@firebase/auth-types';
import { IMemberInfo, IProfileInfo } from '@dbase/data/data.schema';
import { isString, isObject, isNumber } from '@lib/type.library';
import { getStamp, getDateDiff } from '@lib/date.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (info: AdditionalUserInfo) => {
	const profile: { [key: string]: any; } = info.profile || {};
	return {
		provider: info.providerId,
		id: profile.id || profile.login,
		firstName: profile.given_name || profile.first_name || profile.firstName,
		lastName: profile.family_name || profile.last_name || profile.lastName,
		displayName: profile.name || profile.login,
		email: profile.email || profile.emailAddress,
		gender: profile.gender,
		picture: profile.pictureUrl
			|| profile.thumbnail
			|| profile.avatar_url									// github
			|| isString(profile.picture) && profile.picture
			|| isObject(profile.picture) && isObject(profile.picture.data) && profile.picture.data.url
			|| undefined,
		birthday: profile.birthday && getStamp(profile.birthday),
	} as IMemberInfo
}

// each Provider might report a different birthday; take latest
export const getMemberBirthday = (info: IProfileInfo[] = []) =>
	Math.max(...info
		.map(row => row.detail.birthday)
		.filter(isNumber))

export const getMemberAge = (info?: IProfileInfo[]) =>
	getDateDiff(getMemberBirthday(info));
