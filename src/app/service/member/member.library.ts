import { PlanState } from '@dbase/state/state.define';
import { FIELD, PAYMENT, PRICE } from '@dbase/data.define';
import { ProfileInfo, Payment } from '@dbase/data.schema';

import { isString, isNumber, isDefined } from '@library/type.library';
import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { getStamp, getInstant, Instant } from '@library/instant.library';

// Library of member-related functions

// assemble a standard Member Info object
export const getMemberInfo = (provider: firebase.default.auth.AdditionalUserInfo) => {
	const profile: Record<string, any> = provider.profile ?? {};

	const profileInfo: ProfileInfo["info"] = {
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

export const getMemberAge = (info: ProfileInfo[] = [], dt?: Instant.TYPE) =>
	getInstant(getMemberBirthDay(info)).diff('years', dt);		// diff from dt (default today)

/**
 * A Member's Payment will auto-expire (i.e. unused funds lapse) if not fully-used after a number of months (expiry).  
 * 
 * Expiry will be set when  
 * a) a Payment becomes effective (either an Attend is first booked on it, or the prior Payment expired)  
 * b) a Payment.pay record (like topUp, onHold, adjust) is stamped.   
 */
export const calcExpiry = (stamp: number, payment: Payment, client: PlanState["client"]) => {
	const plan = client.plan[0] || {};										// description of Member's current Plan
	const topUp = client.price.find(row => row[FIELD.Type] === PRICE.TopUp);
	const amounts = calcPayment(payment);
	const hold = amounts.hold || 0;
	const paid = amounts[PAYMENT.TopUp] + amounts[PAYMENT.Adjust] + (payment.bank || 0);

	if (topUp && isDefined(plan.expiry)) {								// plan.expiry is usually six-months
		const offset = topUp.amount													// number of months to extend expiry-date
			? Math.round(paid / (topUp.amount / plan.expiry)) || 1	// never less-than one month
			: plan.expiry;																		// allow for gratis account expiry
		return getInstant(stamp)
			.add(offset, 'months')														// number of months to extend expiry-date
			.add(hold, 'days')																// number of days to *hold* off expiry
			.startOf('day').ts																// set to beginning of day
	}

	return undefined;
}

/**
 * A Member's Payment record contains an array of fees, all of which need an Approval stamp
 */
export const calcPayment = (payment?: Payment, approvedOnly = false) => {
	const obj = {} as Record<PAYMENT, number>;
	Object.values(PAYMENT)
		.forEach(pay => obj[pay] = 0);											// init all Payment-types to 0

	return payment
		? payment.pay.reduce((acc, itm) => {
			if (!approvedOnly || (approvedOnly && itm.stamp))
				acc[itm[FIELD.Type]] = (acc[itm[FIELD.Type]] || 0) + itm.amount;
			return acc;
		}, obj)
		: obj
}

export const showPayment = (payment?: Payment) => {
	const obj = {} as Record<PAYMENT, Payment["pay"]>;
	Object.values(PAYMENT)
		.forEach(pay => obj[pay] = [])										// init all Payment-types to []

	return payment
		? payment.pay.reduce((acc, itm) => {
			acc[itm[FIELD.Type]].push(itm);
			return acc;
		}, obj)
		: obj
}