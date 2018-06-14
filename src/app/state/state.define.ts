
export const SLICE = {
	client: 'client',
	auth: 'auth',
	router: 'router',
	member: 'member',
}

export type selector = (state: any, ...states: any[]) => { [store: string]: any; }