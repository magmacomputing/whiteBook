import * as firebase from 'firebase/app';

import { StateService } from '@dbase/state/state.service';
import { IMemberState, IAccountState } from '@dbase/state/state.define';
import { FIELD, STORE } from '@dbase/data/data.define';
import { IProfileInfo, IMemberInfo, IPrice } from '@dbase/data/data.schema';

import { isString, isObject, isNumber } from '@lib/type.library';
import { getStamp, getDate } from '@lib/date.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (provider: firebase.auth.AdditionalUserInfo) => {
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
			|| profile.profile_image_url_https								// twitter
			|| profile.avatar_url															// github
			|| isString(profile.picture) && profile.picture 	// google
			|| isObject(profile.picture) && isObject(profile.picture.data) && profile.picture.data.url // facebook
			|| undefined,
		birthDay: profile.birthday,
	}

	if (profileInfo.photoURL)															// strip the queryParams
		profileInfo.photoURL = profileInfo.photoURL.split('?')[0];
	if (profileInfo.birthDay)															// as number
		profileInfo.birthDay = getStamp(profileInfo.birthDay)

	return profileInfo;
}

// each Provider might report a different birthday; take latest
export const getMemberBirthDay = (info: IProfileInfo[] = []) => {
	const birthDays = info
		.map(row => row.birthDay)
		.filter(isNumber)
	return birthDays.length ? Math.max(...birthDays) : undefined;
}

export const getMemberAge = (info: IProfileInfo[] = []) =>
	getDate(getMemberBirthDay(info)).diff();						// diff (in years) from today

/**
 * Determine if a new payment is due.  
 * -> if the price of the intended class is greater than their current credit  
 * -> if they've exceeded 99 Attends against a Payment  
 * -> if their intro-pass has expired (auto bump them to 'member' plan)  
 */
export const paymentDue = () => {
	return true;
}

/** A Member's payment will auto-expire (i.e. unused funds are reversed) after a number of months */
export const calcExpiry = (stamp: number, paidAmount: number, state: IAccountState) => {
	const plan = state.client.plan[0] || {};					// description of Member's current Plan
	const topUp = state.client.price.find(row => row[FIELD.type] === 'topUp');

	if (topUp && plan.active) {												// plan.active is usually six-months
		const offset = Math.round(paidAmount / (topUp.amount / plan.active)) || 1;
		return getDate(stamp).add(offset, 'months').startOf('day').ts;
	}
	return undefined;
}