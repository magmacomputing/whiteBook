import type { TimetableState } from '@dbase/state/state.define';
import { FIELD, BONUS, COLLECTION, STORE, PLAN, CLASS } from '@dbase/data.define';
import type { Gift, TBonus, Attend, Bonus, ProfilePlan } from '@dbase/data.schema';

import { Instant, getInstant } from '@library/instant.library';
import { TString, isUndefined, nullToZero } from '@library/type.library';
import { plural } from '@library/string.library';
import { asArray } from '@library/array.library';

/**
 * Determine if provided event is entitled to a Gift, a Bonus  (else full-price)
 * source:	info about the effective Plans, Bonus, etc. and current Member
 * event:	  a Class name
 * date:		effective date, else today
 * elect:		Bonus override (e.g. Member may elect to *not* use one of their Gifts)
 */
export const calcBonus = (source: TimetableState, event: CLASS, date?: Instant.TYPE, elect?: BONUS) => {
	const now = getInstant(date);
	const bonus = {} as TBonus;															// calculated Bonus entitlement
	const gifts = source[COLLECTION.Member][STORE.Gift];		// the active Gifts for this Member
	const plans = source[COLLECTION.Member][STORE.Plan];		// the current Member plan
	const { attendGift = [], attendWeek = [], attendMonth = [], attendToday = [] } = source[COLLECTION.Attend];

	(source[COLLECTION.Client][STORE.Bonus] || [])					// current Bonus schemes to which the Member is entitled
		.forEach(scheme => {																	// loop over each Bonus in its sort-order
			if (bonus[FIELD.Id])																// if a prior forEach found an applicable Bonus...
				return;																						// 	skip checking the rest

			switch (scheme[FIELD.Key]) {
				case BONUS.None:																	// not entitled to attend-related Bonus
					break;

				case BONUS.Gift:
					bonusGift(bonus, gifts, attendGift, now, elect);
					break;

				case BONUS.Week:
					bonusWeek(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.Month:
					bonusMonth(bonus, scheme, attendMonth, now, elect);
					break;

				case BONUS.Class:
					bonusClass(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.Sunday:
					bonusSunday(bonus, scheme, attendWeek, now, elect, event);
					break;

				case BONUS.Home:
					bonusHome(bonus, scheme, attendToday, plans?.[0], elect, event);
					break;
			}
		})

	return bonus;
}

/**
 * Admin adds 'Gift' records to a Member's account, which will detail the start-date
 * and limit of free classes (and an optional expiry-date as 'use-by' for the Gift).  
 * 
 * A Member may have multiple active Gifts; check all of them if they are still useable.  
 * Any Gifts that have passed their expiry-date will be marked as closed.
 */
const bonusGift = (bonus: TBonus, gifts: Gift[], attendGift: Attend[], now: Instant, elect = BONUS.Gift) => {
	const upd: Gift[] = [];																			// an array of updates for calling-function to apply on /member/gift
	let curr = -1;																							// the Gift to use in determining eligibility

	gifts.forEach((gift, idx) => {
		gift.count = attendGift																		// attendGift might relate to multiple-Gifts
			.filter(attd => attd.bonus?.[FIELD.Id] === gift[FIELD.Id])
			.length + 1;																						// count the Attends for this Gift, plus one for this one
		const giftLeft = gift.limit - gift.count;									// how many remain

		switch (true) {
			case giftLeft < 0:																			// max number of Attends against this Gift reached
			case nullToZero(gift.expiry) > now.ts:									// or this Gift has expired
				upd.push({ ...gift, [FIELD.Expire]: now.ts });				// auto-expire it
				break;

			case elect !== BONUS.Gift:															// Member elected to not use a Gift
				break;																								// (e.g. BONUS.none, BONUS.class, ...)

			case curr === -1:																				// found the first useable Gift
				curr = idx;																						// to stop further checking
				upd.push({																						// stack a Gift update
					...gift,																						// spread Gift
					[FIELD.Effect]: gift[FIELD.Effect] ?? now.ts,				// if first usage of this Gift
					[FIELD.Expire]: giftLeft === 0 ? now.ts : undefined,// if last usage of this Gift
				})
				Object.assign(bonus, {																// assign Bonus
					[FIELD.Id]: gift[FIELD.Id],
					[FIELD.Type]: BONUS.Gift,
					note: `${giftLeft} ${plural(giftLeft, 'gift')}`,
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
const bonusWeek = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.Week) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);			// the dow on which the Bonus qualified

	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.Type] === BONUS.Gift)
		.filter(row => row.track[FIELD.Date] < today)							// dont count today's attend
		.distinct(row => row.track[FIELD.Date])										// de-dup by day-of-week
		.length >= scheme.level																		// must attend the 'level' number
	const weekCnt = attendWeek
		.filter(row => row.bonus?.[FIELD.Type] === BONUS.Week)		// how many of those were BONUS.week
		.map(row => row.track[FIELD.Date])												// just the track.date field
		.sort()																										// should be a single-date, but just in case...
	const okFree = weekCnt.length === 0 ||											// if first Bonus of the day, or...
		(weekCnt[0] === today && weekCnt.length < scheme.free)	// same day, and within scheme.free limit
	const okElect = elect === BONUS.Week;												// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect)
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.Id]: scheme[FIELD.Id],
				[FIELD.Type]: BONUS.Week,
				note: scheme.note,
				count: attendWeek.filter(row => row.bonus?.[FIELD.Type] === BONUS.Week).length + 1,
			})

	return;
}

/**
 * The Class scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.level).  
 * The Member must also have claimed less than the free limit (scheme.free) to enable this bonus
 * (note: even 'Gift Attends' count towards a Bonus)  
 * (note: scheme.free can cover multiple calendar days)* 
 */
const bonusClass = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.Class) => {
	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.Type] === BONUS.Gift)
		.length >= scheme.level																		// must attend the 'level' number
	const okFree = attendWeek																		// sum the bonus claimed
		.filter(row => row.bonus?.[FIELD.Type] === BONUS.Class)
		.length < scheme.free																			// must attend less than 'free' number
	const okElect = elect === BONUS.Class;											// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.Id]: scheme[FIELD.Id],
				[FIELD.Type]: BONUS.Class,
				note: scheme.note,
				count: attendWeek.filter(row => row.bonus?.[FIELD.Type] === BONUS.Class).length + 1,
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
const bonusSunday = (bonus: TBonus, scheme: Bonus, attendWeek: Attend[], now: Instant, elect = BONUS.Sunday, event: string) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendWeek																	// count Attends this week either Gift or non-Bonus
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.Type] === BONUS.Gift)
		.filter(row => row.track[FIELD.Date] !== today)						// dont count today's attend
		.distinct(row => row.track[FIELD.Date])										// de-dup by day-of-week
		.length >= scheme.level																		// required number of Attends this week
	const okFree = asArray(scheme.free as TString).includes(event);
	const okElect = elect === BONUS.Sunday && now.dow === Instant.WEEKDAY.Sun;

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.Id]: scheme[FIELD.Id],
				[FIELD.Type]: BONUS.Sunday,
				note: scheme.note,
				count: attendWeek.filter(row => row.bonus?.[FIELD.Type] === BONUS.Sunday).length + 1,
			})
	}

	return;
}

/**
 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.level).  
 * The Member must also have attended less than the free limit (scheme.free) to qualify for this bonus
 */
const bonusMonth = (bonus: TBonus, scheme: Bonus, attendMonth: Attend[], now: Instant, elect = BONUS.Month) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendMonth
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.Type] === BONUS.Gift)
		.filter(row => row.track[FIELD.Date] !== today)								// dont count today's attend
		.distinct(row => row.track[FIELD.Date])
		.length >= scheme.level
	const okFree = attendMonth
		.filter(row => row.bonus?.[FIELD.Type] === BONUS.Month)
		.length < scheme.free
	const okElect = (isUndefined(elect) || elect === BONUS.Month);

	if (okLevel && okFree && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.Id]: scheme[FIELD.Id],
				[FIELD.Type]: BONUS.Month,
				note: scheme.note,
				count: attendMonth.filter(row => row.bonus?.[FIELD.Type] === BONUS.Month).length + 1,
			})
	}

	return;
}

/**
 * The Home scheme qualifies as a Bonus if the Member has already attended a paid '@Home' class earlier today.  
 * Note: PLAN.sponsor gets the Bonus for any type of @Home class today (eg. Step@Home, Rumba@Home),  
 * all others get the Bonus for any attending the same type of @Home class today (eg. Step@Home).  
 * scheme.free is set to '@Home'
 */
const bonusHome = (bonus: TBonus, scheme: Bonus, attendToday: Attend[], profile: ProfilePlan, elect = BONUS.Home, event: string) => {
	const home = scheme.free as string;
	if (!event.endsWith(home))																			// Event must be of type '@Home'
		return;

	const okLevel = attendToday
		.filter(attend => {
			return profile.plan === PLAN.Sponsor
				? attend.timetable[FIELD.Key].endsWith(home)							// attended any @Home event today
				: attend.timetable[FIELD.Key] === event										// else same @Home event today
		})
		.length >= scheme.level																				// required number of Attends today
	const okElect = elect === BONUS.Home;														// Member elected to take Bonus

	if (okLevel && okElect) {
		Object.assign(bonus, isUndefined(scheme.amount) ? undefined : { amount: scheme.amount },
			{
				[FIELD.Id]: scheme[FIELD.Id],
				[FIELD.Type]: BONUS.Home,
				note: scheme.note,
				count: attendToday.length + 1,
			})
	}

	return;
}