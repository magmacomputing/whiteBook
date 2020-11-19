/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  const response = `${data}: worker response`;
  postMessage(response);
})
