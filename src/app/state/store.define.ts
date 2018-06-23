import { FIELD } from '@dbase/fire/fire.define';

export const SLICE = {
    client: 'client',
    auth: 'auth',
    router: 'router',
    member: 'member',
    attend: 'attend',
}

export interface IStoreDoc {
    store: string;
    [FIELD.id]: string;
    [key: string]: any;
}

export interface IStoreState {
    [store: string]: IStoreDoc[];
}

export type selector = (state: any, ...states: any[]) => { [store: string]: any; }