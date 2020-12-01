import type { PlanState } from '@dbase/state/state.define';
import type { ProfileInfo, Payment, Price } from '@dbase/data.schema';
import { FIELD, PAYMENT, PRICE } from '@dbase/data.define';

import { getStamp, getInstant, Instant } from '@library/instant.library';
import { isString, isNumber, isDefined, isUndefined } from '@library/type.library';
import { cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';

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

	profileInfo.photoURL = profileInfo.photoURL?.split('?')[0];// strip the queryParams
	if (profileInfo.birthDate)														// as stamp
		profileInfo.birthDate = getStamp(profileInfo.birthDate);

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
 * A Member's Payment will auto-expire (i.e. unused funds lapse) if not fully-spent after a number of months (expiry).  
 * A nightly batch will mark these payments with a pay.adjust to bring the value down to $0.  
 * Once the Admin approves (stamps) the adjust, the Payment has its _expire set, and the Account is effectively closed.
 * 
 * Even though 'expiry' is a calculated-field, it is stored on the Payment to allow search / display
 * 
 * expiry will be first set when a topUp is approved (stamped).  (never approved means never expires!)
 * After that, it will be updated when:  
 * *> the first Attend is recorded against it,  
 * *> a pay-Adjust is approved, or  
 * *> a pay-Hold is approved
 */
export const calcExpiry = (payment: Payment, client: PlanState["client"]) => {
	const plan = client.plan[0];													// description of Member's current Plan
	const pay = [...payment.pay];													// clone the Payment amounts

	if (isUndefined(plan?.expiry))												// if Plan does not expire
		return undefined;																		// then Payment does not lapse
	if (pay.some(pay => isUndefined(pay[FIELD.Stamp])))
		return undefined;																		// All pays need to be approved
	// if (payment[FIELD.Expire])														// TODO: should we auto un-expire?
	// 	return undefined;																		// Closed Payment

	const stamps = pay
		.filter(pay => pay.amount > 0)											// discard negative pay.amounts
		.map(pay => pay[FIELD.Stamp]!)											// get list of tstamps
	if (isDefined(payment[FIELD.Stamp]))
		stamps.push(payment[FIELD.Stamp]);									// allow for Bought stamp
	if (isDefined(payment[FIELD.Effect]))
		stamps.push(payment[FIELD.Effect]!);								// allow for 1st Attend stamp

	const last = pay.slice(-1)[0];
	if (last[FIELD.Type] === PAYMENT.Hold)								// allow additional 'hold' days after approved
		stamps.push(getInstant(last[FIELD.Stamp]).add(last.hold ?? 0, 'days').ts);

	const stamp = Math.max(...stamps);										// date of last pay-activity
	const paid = pay.reduce((acc, itm) => acc += itm.amount ?? 0,
		payment.bank ?? 0);																	// sum of all pays, plus bank

	const topUp = client.price.find(row => row[FIELD.Type] === PRICE.TopUp);
	const offset = topUp?.amount													// number of months to extend expiry-date
		? Math.round(paid / (topUp.amount / plan.expiry)) || 1	// never less-than one month
		: plan.expiry;																			// allow for gratis account expiry

	return getInstant(stamp)
		.add(offset, 'months')															// number of months to extend expiry-date
		.startOf('day').ts																	// set to beginning of day
}

/**
 * A Member's Payment record contains an array of pays, all of which need an Approval stamp
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