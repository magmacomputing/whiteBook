const SWIPE_ACTION = { LEFT: 'swipeleft', RIGHT: 'swiperight' };
const BASE_VELOCITY = 0.3;

export const swipe = (selectedIndex: number, lastIndex: number, event: any) => {
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
      steps = 3
      break;
    default:
      steps = 4
  }

  if (event.type === SWIPE_ACTION.LEFT) {
    const isLast = selectedIndex + steps >= lastIndex - 1;
    selectedIndex = isLast ? lastIndex - 1 : selectedIndex + steps;
  }
  if (event.type === SWIPE_ACTION.RIGHT) {
    const isFirst = selectedIndex - steps <= 0;
    selectedIndex = isFirst ? 0 : selectedIndex - steps;
  }

  return selectedIndex;
}