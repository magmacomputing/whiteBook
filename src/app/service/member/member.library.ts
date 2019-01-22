import * as firebase from 'firebase/app';

import { StateService } from '@dbase/state/state.service';
import { IProfileInfo, IMemberInfo } from '@dbase/data/data.schema';

import { isString, isObject, isNumber, isDate } from '@lib/type.library';
import { getStamp, getDate } from '@lib/date.library';
import { FIELD, STORE } from '@dbase/data/data.define';

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
	else delete profileInfo.birthDay;

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

/** loop back up-to-seven days to find when className was last scheduled */
export const lkpDate = async (state: StateService, className: string, location?: string, date?: number) => {
	const timetable = await state.getTimetableData(date).toPromise();
	let now = getDate(date);													// start with date-argument
	let ctr = 0;

	if (!location)
		location = state.getDefault(timetable, STORE.location);

	for (ctr; ctr < 7; ctr++) {
		const classes = timetable.client.schedule!			// loop through schedule
			.filter(row => row.day === now.ww)						// finding a match in 'day'
			.filter(row => row[FIELD.key] === className)	// and match in 'class'
			.filter(row => row.location === location)			// and match in 'location'

		if (classes.length)															// is this class offered on this 'day'   
			break;
		now = now.add(-1, 'day');												// move pointer to previous day
	}

	if (ctr >= 7)																			// cannot find className on timetable
		now = getDate(date);														// so default back to today's date	

	return now.ts;																		// timestamp
}
