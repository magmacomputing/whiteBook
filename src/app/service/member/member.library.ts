import * as firebase from 'firebase/app';

import { StateService } from '@dbase/state/state.service';
import { IProfileInfo, IMemberInfo } from '@dbase/data/data.schema';

import { isString, isObject, isNumber } from '@lib/type.library';
import { getStamp, diffDate, getDate, parseDate } from '@lib/date.library';
import { FIELD } from '@dbase/data/data.define';

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
		profileInfo.birthDay = getStamp(profileInfo.birthDay);

	return profileInfo;
}

// each Provider might report a different birthday; take latest
export const getMemberBirthDay = (info: IProfileInfo[] = []) =>
	Math.max(...info
		.map(row => row.birthDay)
		.filter(isNumber))

export const getMemberAge = (info?: IProfileInfo[]) =>
	diffDate(getMemberBirthDay(info));

/**
 * Determine if a new payment is due.  
 * -> if the price of the intended class is greater than their current credit  
 * -> if they've exceeded 99 Attends against a Payment  
 * -> if their intro-pass has expired (auto bump them to 'member' plan)  
 */
export const paymentDue = () => {
	return true;
}

/** loop back over up-to-seven days to find when className was last scheduled */
export const lkpDate = async (className: string, state: StateService, date?: number) => {
	const timetable = await state.getTimetableData().toPromise();
	let base = getDate(date);													// start with today's date
	let ctr = 0;

	for (ctr = 0; ctr <= 7; ctr++) {
		const now = parseDate(base);										// get the date components
		const classes = timetable.client.schedule!			// loop through schedule
			.filter(row => row.day === now.ww)						// finding a match in 'day'
			.filter(row => row[FIELD.key] === className)

		if (classes.length)															// is this class offered on this 'day'   
			break;
		now.add(-1, 'days');														// move pointer to previous day
	}

	if (ctr > 7)																			// cannot find className on timetable
		base = getDate(date);														// so default back to today's date	

	return getStamp(base);
}
