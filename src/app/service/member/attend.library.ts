import { TimetableState } from '@dbase/state/state.define';
import { FIELD, BONUS, COLLECTION, STORE, PLAN } from '@dbase/data/data.define';
import type { Gift, TBonus, Attend, Bonus, ProfilePlan } from '@dbase/data/data.schema';

import { TInstant, getDate, Instant } from '@library/instant.library';
import { TString, isUndefined, nullToZero } from '@library/type.library';
import { asArray } from '@library/array.library';
import { plural } from '@library/string.library';

/**
 * Determine if provided event is entitled to a Gift or a Bonus  
 * source:	info about the effective Plans, Bonus, etc. and current Member
 * event:	  a Class name
 * date:		effective date, else today
 * elect:		Bonus override (e.g. Member may elect to *not* use one of their Gifts)
 */
export const calcBonus = (source: TimetableState, event: string, date?: TInstant, elect?: BONUS) => {
	const now = getDate(date);
	const bonus = {} as TBonus;															// calculated Bonus entitlement

	const gifts = source[COLLECTION.member][STORE.gift];		// the active Gifts for this Member
	const plan = source[COLLECTION.member][STORE.plan][0];	// the current Member plan
	const { attendGift = [], attendWeek = [], attendMonth = [], attendToday = [] } = source[COLLECTION.attend];

	(source[COLLECTION.client][STORE.bonus] || [])					// current Bonus schemes to which the Member is entitled
		.forEach(scheme => {																	// loop over each Bonus in its sort-order
			if (bonus[FIELD.id])																// if a prior forEach determined a Bonus...
				return;																						// 	skip checking the rest

			switch (scheme[FIELD.key]) {
				case BONUS.none:																	// not entitled to attend-related Bonus
					break;

				case BONUS.gift:
					bonusGift(bonus, gifts, attendGift, now, elect);
					break;

				case BONUS.week:
					bonusWeek(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.month:
					bonusMonth(bonus, scheme, attendMonth, now, elect);
					break;

				case BONUS.class:
					bonusClass(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.sunday:
					bonusSunday(bonus, scheme, attendWeek, now, elect, event);
					break;

				case BONUS.home:
					bonusHome(bonus, scheme, attendToday, plan, elect, event);
					break;
			}
		})

	return bonus;
}

/**
 * Admin adds 'Gift' records to a Member's account, which will detail the start-date
 * and limit of free classes (and an optional expiry-date for the Gift).  
 * 
 * Even though the Member may have an active Gift, we check all of them if they are useable.  
 * Any Gifts that have passed their expiry-date will be marked as closed.
 */
const bonusGift = (bonus: TBonus, gifts: Gift[], attendGift: Attend[], now: Instant, elect = BONUS.gift) => {
	const upd: Gift[] = [];																		// an array of updates for calling-function to apply on /member/gift
	let curr = -1;																							// the Gift to use in determining eligibility

	gifts.forEach((gift, idx) => {
		gift.count = attendGift																		// attendGift might relate to multiple-Gifts
			.filter(attd => attd.bonus?.[FIELD.id] === gift[FIELD.id])
			.length + 1;																						// count the Attends for this Gift, plus one for this one
		const giftLeft = gift.limit - gift.count;									// how many remain

		switch (true) {
			case giftLeft < 0:																			// max number of Attends against this Gift reached
			case nullToZero(gift.expiry) > now.ts:									// or this Gift has expired
				upd.push({ [FIELD.expire]: now.ts, ...gift });				// auto-expire it
				break;

			case elect !== BONUS.gift:															// Member elected to not use a Gift
				break;																								// (e.g. BONUS.none, BONUS.class, ...)

			case curr === -1:																				// found the first useable Gift
				curr = idx;																						// to stop further checking
				upd.push({																						// stack a Gift update
					[FIELD.effect]: now.ts,															// if first usage of this Gift
					[FIELD.expire]: giftLeft === 0 ? now.ts : undefined,// if last usage of this Gift
					...gift,																						// spread Gift (note: ok to override FIELD.effect with its prior value)
				})
				Object.assign(bonus, {																// assign Bonus
					[FIELD.id]: gift[FIELD.id],
					[FIELD.type]: BONUS.gift,
					desc: `${giftLeft} ${plural(giftLeft, 'gift')}`,
					count: gift.count,
				})
				break;
		}
	})

	if (upd.length)																							// whether or not we found an applicable Bonus,
		bonus.gift = upd;																					// let calling-function know about any Gift updates to be applied

	return;
}
/**
 * The Week scheme qualifies as a Bonus if the Member attends the required number of non-bonus days in a week (scheme.level).  
 * The Member must also have claimed less than the free limit (scheme.free) to enable this bonus
 * (note: even 'Gift Attends' count towards a Bonus)  
 * (note: scheme.free only covers one calendar day)
 */
const bonusWeek = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.week) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);																					// the dow on which the Bonus qualified

	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] < today)							// dont count today's attend
		.distinct(row => row.track[FIELD.date])										// de-dup by day-of-week
		.length >= scheme.level																		// must attend the 'level' number
	const weekCnt = attendWeek
		.filter(row => row.bonus?.[FIELD.type] === BONUS.week)		// how many of those were BONUS.week
		.map(row => row.track[FIELD.date])												// just the track.date field
		.sort()																										// should be a single-date, but just in case...
	const okFree = weekCnt.length === 0 ||											// if first Bonus of the day, or...
		( weekCnt[0] === today && weekCnt.length < scheme.free )	// same day, and within scheme.free limit
	const okElect = elect === BONUS.week;												// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect)
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.id]: scheme[FIELD.id],
				[FIELD.type]: BONUS.week,
				desc: scheme.desc,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.week).length + 1,
			})

	return;
}

/**
 * The Class scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.level).  
 * The Member must also have claimed less than the free limit (scheme.free) to enable this bonus
 * (note: even 'Gift Attends' count towards a Bonus)  
 * (note: scheme.free can cover multiple calendar days)* 
 */
const bonusClass = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.class) => {
	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.length >= scheme.level																		// must attend the 'level' number
	const okFree = attendWeek																		// sum the bonus claimed
		.filter(row => row.bonus?.[FIELD.type] === BONUS.class)
		.length < scheme.free																			// must attend less than 'free' number
	const okElect = elect === BONUS.class;											// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.id]: scheme[FIELD.id],
				[FIELD.type]: BONUS.class,
				desc: scheme.desc,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.class).length + 1,
			})
	}

	return;
}

/**
 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.level).  
 * The class must be in the free list (scheme.free) to qualify for this bonus
 * (note: the Week scheme should take precendence, if qualifies on Sunday and not claimed on Saturday)  
 * (note: even 'Gift Attends' count towards a Bonus)  
 */
const bonusSunday = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.sunday, event: string) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendWeek																	// count Attends this week either Gift or non-Bonus
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] !== today)						// dont count today's attend
		.distinct(row => row.track[FIELD.date])										// de-dup by day-of-week
		.length >= scheme.level																		// required number of Attends this week
	const okFree = asArray(scheme.free as TString).includes(event);
	const okElect = elect === BONUS.sunday && now.dow === Instant.WEEKDAY.Sun;

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.id]: scheme[FIELD.id],
				[FIELD.type]: BONUS.sunday,
				desc: scheme.desc,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.sunday).length + 1,
			})
	}

	return;
}

/**
 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.level).  
 * The Member must also have attended less than the free limit (scheme.free) to qualify for this bonus
 */
const bonusMonth = (bonus: TBonus, scheme: Bonus, attendMonth: Attend[], now: Instant, elect = BONUS.month) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendMonth
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] !== today)								// dont count today's attend
		.distinct(row => row.track[FIELD.date])
		.length >= scheme.level
	const okFree = attendMonth
		.filter(row => row.bonus?.[FIELD.type] === BONUS.month)
		.length < scheme.free
	const okElect = (isUndefined(elect) || elect === BONUS.month);

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.id]: scheme[FIELD.id],
				[FIELD.type]: BONUS.month,
				desc: scheme.desc,
				count: attendMonth.filter(row => row.bonus?.[FIELD.type] === BONUS.month).length + 1,
			})
	}

	return;
}

/**
 * The Home scheme qualifies as a Bonus if the Member has already attended an '@Home' class earlier today
 */
const bonusHome = (bonus: TBonus, scheme: Bonus, attendToday: Attend[], profile: ProfilePlan, elect = BONUS.home, event: string) => {
	if (profile.plan === PLAN.sponsor)															// TODO: workaround this hard-coded check
		event = 'Home';																								// check only the '@Home' suffix

	const okLevel = attendToday
		.filter(attend => {
			return profile.plan === PLAN.sponsor
				? attend.timetable[FIELD.key].split('@')[1] === event			// attended any @Home event today
				: attend.timetable[FIELD.key] === event										// else same @Home event today
		})
		.length >= scheme.level																				// required number of Attends today
	const okElect = elect === BONUS.home;														// Member elected to take Bonus

	if (okLevel && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.id]: scheme[FIELD.id],
				[FIELD.type]: BONUS.home,
				desc: scheme.desc,
				count: attendToday.length + 1,
			})
	}

	return;
}