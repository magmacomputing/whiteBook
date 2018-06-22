
export const SLICE = {
    client: 'client',
    auth: 'auth',
    router: 'router',
    member: 'member',
    attend: 'attend',
}

export type selector = (state: any, ...states: any[]) => { [store: string]: any; }