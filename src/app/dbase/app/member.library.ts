import { AdditionalUserInfo } from '@firebase/auth-types';
import { IProfileInfo, IMemberInfo } from '@dbase/data/data.schema';
import { isString, isObject, isNumber } from '@lib/type.library';
import { getStamp, getDateDiff } from '@lib/date.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (provider: AdditionalUserInfo) => {
	const profile: { [key: string]: any; } = provider.profile || {};

	const profileInfo: IMemberInfo = {
		providerId: provider.providerId,
		providerUid: profile.id || profile.login,
		firstName: profile.given_name || profile.first_name || profile.firstName,
		lastName: profile.family_name || profile.last_name || profile.lastName,
		displayName: profile.name || profile.login
			|| (profile.given_name || profile.first_name || profile.firstName) + ' ' + (profile.family_name || profile.last_name || profile.lastName),
		email: profile.email || profile.emailAddress,
		gender: profile.gender,
		photoURL: profile.pictureUrl
			|| profile.thumbnail															// linkedin
			|| profile.avatar_url															// github
			|| isString(profile.picture) && profile.pictureUrl// google
			|| isObject(profile.picture) && isObject(profile.picture.data) && profile.picture.data.url // facebook
			|| undefined,
		birthDay: profile.birthday,
	}

	if (profileInfo.photoURL)															// strip the queryParams
		profileInfo.photoURL = profileInfo.photoURL.split('?')[0];
	if (profileInfo.birthDay)															// as number
		profileInfo.birthDay = getStamp(profileInfo.birthDay);

	return profileInfo;
}

// each Provider might report a different birthday; take latest
export const getMemberBirthDay = (info: IProfileInfo[] = []) =>
	Math.max(...info
		.map(row => row.birthDay)
		.filter(isNumber))

export const getMemberAge = (info?: IProfileInfo[]) =>
	getDateDiff(getMemberBirthDay(info));

/**
 * Determine if a new payment is due.  
 * -> if the price of the intended class is greater than their current credit  
 * -> if they've exceeded 99 Attends against a Payment  
 * -> if their intro-pass has expired (auto bump them to 'member' plan)  
 */
export const paymentDue = () => {
	return true;
}