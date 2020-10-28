import { PlanState } from '@dbase/state/state.define';
import { FIELD } from '@dbase/data/data.define';
import { ProfileInfo, MemberInfo, Payment } from '@dbase/data/data.schema';

import { isString, isNumber, isUndefined } from '@library/type.library';
import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { getStamp, getInstant, TInstant } from '@library/instant.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (provider: firebase.default.auth.AdditionalUserInfo) => {
	const profile: Record<string, any> = provider.profile ?? {};

	const profileInfo: MemberInfo = {
		providerId: provider.providerId,
		providerUid: profile.id || profile.login,
		firstName: profile.given_name || profile.first_name || profile.firstName,
		lastName: profile.family_name || profile.last_name || profile.lastName,
		displayName: profile.formattedName || profile.displayName || profile.name || profile.login,
		email: profile.email ?? profile.emailAddress,
		gender: profile.gender,
		photoURL: profile.photoURL
			|| profile.pictureUrl
			|| profile.thumbnail															// linkedin
			|| profile.profile_image_url_https								// twitter
			|| profile.avatar_url															// github
			|| (isString(profile.picture) && profile.picture)	// google
			|| profile.picture?.data?.url,										// facebook
		birthDate: profile.birthDay ?? profile.birthday,
	}

	if (!profileInfo.displayName && profileInfo.firstName && profileInfo.lastName)
		profileInfo.displayName = (profileInfo.firstName + ' ' + profileInfo.lastName).trimAll();

	if (!profileInfo.firstName && !profileInfo.lastName && profileInfo.displayName?.includes(' ')) {
		const name = profileInfo.displayName.trimAll().split(' ');
		profileInfo.lastName = name.pop();
		profileInfo.firstName = name.join(' ');
	}
	if (profileInfo.photoURL)															// strip the queryParams
		profileInfo.photoURL = profileInfo.photoURL.split('?')[0];
	if (profileInfo.birthDate)															// as number
		profileInfo.birthDate = getStamp(profileInfo.birthDate)

	return cloneObj(profileInfo);													// removed 'undefined' fields
}

// each Provider might report a different birthday; take earliest
export const getMemberBirthDay = (info: ProfileInfo[] = []) => {
	const birthDates = asArray(info)
		.map(row => row.info.birthDate)
		.filter(isNumber)
	return birthDates.length ? Math.min(...birthDates) : undefined;
}

export const getMemberAge = (info: ProfileInfo[] = [], dt?: TInstant) =>
	getInstant(getMemberBirthDay(info)).diff('years', dt);		// diff from dt (default today)

/**
 * A Member's payment will auto-expire (i.e. unused funds lapse) if not fully-used after a number of months.  
 * 1. Expiry will not be set until a Payment becomes active (all earlier Payments expired).
 * 2. When the nightly batch expires a prior Payment, it uses the Payment.stamp as the 'from' date.
 * 3. When the first Attend against a Payment is made, it uses the Attend.stamp to reset the 'from' date.  
 */
export const calcExpiry = (stamp: number, payment: Payment, client: PlanState["client"]) => {
	const plan = client.plan[0] || {};										// description of Member's current Plan
	const topUp = client.price.find(row => row[FIELD.type] === 'topUp');
	const hold = payment.hold || 0;
	const paid = (payment.amount || 0) + (payment.adjust || 0) + (payment.bank || 0);

	if (topUp && !isUndefined(plan.expiry)) {							// plan.expiry is usually six-months
		const offset = topUp.amount													// number of months to extend expiry-date
			? Math.round(paid / (topUp.amount / plan.expiry)) || 1
			: plan.expiry;																		// allow for gratis account expiry
		return getInstant(stamp)
			.add(offset, 'months')														// number of months to extend expiry-date
			.add(hold, 'days')																// number of days to *hold* off expiry
			.startOf('day').ts																// set to beginning of day
	}

	return undefined;
}