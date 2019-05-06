import * as firebase from 'firebase/app';

import { IPlanState } from '@dbase/state/state.define';
import { FIELD } from '@dbase/data/data.define';
import { IProfileInfo, IMemberInfo, IPayment } from '@dbase/data/data.schema';

import { isString, isObject, isNumber, isUndefined } from '@lib/type.library';
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
	getDate(getMemberBirthDay(info)).diff('years');				// diff from today

/** A Member's payment will auto-expire (i.e. unused funds lapse) after a number of months */
export const calcExpiry = (stamp: number, payment: IPayment, client: IPlanState["client"]) => {
	const plan = client.plan[0] || {};								// description of Member's current Plan
	const topUp = client.price.find(row => row[FIELD.type] === 'topUp');
	const hold = payment.hold || 0;

	if (topUp && !isUndefined(plan.expiry)) {							// plan.expiry is usually six-months
		const offset = topUp.amount
			? Math.round(payment.amount / (topUp.amount / plan.expiry)) || 1
			: plan.expiry;																		// allow for gratis account expiry
		return getDate(stamp).add(offset, 'months').add(hold, 'days').startOf('day').ts;
	}

	return undefined;
}