export enum ZOOM {
	event = 'body.event',
	joined = 'meeting.participant_joined',
	left = 'meeting.participant_left',
	started = 'meeting.started',
	ended = 'meeting.ended',
	status = 'user.presence_status_updated',
}