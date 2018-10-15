const SWIPE_ACTION = { LEFT: 'swipeleft', RIGHT: 'swiperight' };
const BASE_VELOCITY = 0.3;

// allow for UI to swipe left/right
export const swipe = (thisIndex: number, lastIndex: number, event: any) => {
	const v = Math.abs(event.velocityX);
	let steps: 1 | 2 | 3 | 4;

	switch (true) {
		case v < 2 * BASE_VELOCITY:
			steps = 1;
			break;
		case v < 3 * BASE_VELOCITY:
			steps = 2;
			break;
		case v < 4 * BASE_VELOCITY:
			steps = 3;
			break;
		default:
			steps = 4;
			break;
	}

	if (event.type === SWIPE_ACTION.LEFT) {
		const isLast = thisIndex + steps >= lastIndex - 1;
		thisIndex = isLast ? lastIndex - 1 : thisIndex + steps;
	}
	if (event.type === SWIPE_ACTION.RIGHT) {
		const isFirst = thisIndex - steps <= 0;
		thisIndex = isFirst ? 0 : thisIndex - steps;
	}

	return thisIndex;
}