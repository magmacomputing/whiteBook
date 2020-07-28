import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

enum SWIPE { left = 'swipeleft', right = 'swiperight' };
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

	if (event.type === SWIPE.left) {
		const isLast = thisIndex + steps >= lastIndex - 1;
		thisIndex = isLast ? lastIndex - 1 : thisIndex + steps;
	}
	if (event.type === SWIPE.right) {
		const isFirst = thisIndex - steps <= 0;
		thisIndex = isFirst ? 0 : thisIndex - steps;
	}

	return thisIndex;
}

// allow for UI to drag/drop elements
// TODO: persist item sorting
export const drag = (event: CdkDragDrop<any[]>) =>
	moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);