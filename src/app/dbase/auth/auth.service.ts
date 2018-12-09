import { Injectable } from '@angular/core';
import { map, switchMap, take } from 'rxjs/operators';
import { User } from '@firebase/auth-types';

import { Store } from '@ngxs/store';
import { StateService } from '@dbase/state/state.service';

import { AuthModule } from '@dbase/auth/auth.module';
import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { LoginIdentity, Logout, LoginEmail, LoginOAuth, LoginSetup } from '@dbase/state/auth.action';

import { FIELD, LOCAL } from '@dbase/data/data.define';
import { IProvider, IConfig } from '@dbase/data/data.schema';
import { TScopes, TParams } from '@dbase/auth/auth.interface';

import { IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
	private auth$ = this.state.getAuthData();
	private dbg = dbg(this);

	constructor(private readonly store: Store, private state: StateService) { this.dbg('new'); }

	get active() {
		return this.auth$.pipe(
			take(1),
			map(state => isActive(state)),
		)
	}

	get user() {
		return this.auth$
			.pipe(take(1))
			.toPromise()
	}

	public signOut() {
		this.store.dispatch(new Logout());
	}

	public async signIn(provider: IProvider, opts: IObject<any> = {}) {
		this.dbg('signIn: %j', provider);

		switch (provider[FIELD.type]) {
			case undefined:
			case 'identity':
				this.signInIdentity(provider);
				break;

			case 'oauth':
				this.signInOAuth(provider);
				break;

			case 'email':
				this.signInEmail(provider, opts.email, opts.password);
				break;

			case 'play':
				this.signInPlay(provider);
				break;

			case 'phone':
				this.signInPhone(provider);
				break;

			case 'anonymous':
				this.signInAnon(provider);
				break;

			default:
				this.dbg('signIn: %s', provider);
				break;
		}
	}

	/** prepare the AuthProvider object before dispatching the SignIn flow */
	private signInIdentity(provider: IProvider) {
		const [, authProvider] = getAuthProvider(provider[FIELD.key]);
		if (!authProvider) return;                      // misconfigured providerId

		asArray(provider.scope)
			.forEach(scope => (authProvider as TScopes).addScope(scope));

		if (provider.params)
			(authProvider as TParams).setCustomParameters(provider.params);

		return this.store.dispatch(new LoginIdentity(authProvider));
	}

	/** This runs in the main thread */
	private async signInOAuth(provider: IProvider) {
		const urlQuery = `prefix=${provider.prefix}`;
		const config = await this.state.getSingle<IConfig>(LOCAL.config, { fieldPath: FIELD.key, value: 'oauth' }) || {};
		const oauth = config.value;

		window.open(`${oauth.request_url}?${urlQuery}`, '_blank', 'height=600,width=400');

		const channel = new BroadcastChannel('oauth');
		channel.onmessage = (msg) => {
			channel.close();
			// this.store.dispatch(new LoginAdditionalInfo({ info: JSON.parse(msg.data) }));
			this.dbg('msg: %j', JSON.parse(msg.data));
			this.store.dispatch(new LoginSetup(JSON.parse(msg.data) as User));
		}
	}

	/** This runs in the OAuth popup */
	public signInToken(response: any) {
		return this.store.dispatch(new LoginOAuth(response.token, response.prefix, response.user))
			.pipe(switchMap(_ => this.auth$))			// this will fire multiple times, as AuthState settles
			.subscribe(state => {
				// if (state.auth.info) 								// tell the main thread to update State
				// 	new BroadcastChannel('oauth')
				// 		.postMessage(JSON.stringify(state.auth.info));
				if (state.auth.user) {
					new BroadcastChannel('oauth')
						.postMessage(JSON.stringify(state.auth.user))

					// if (state.auth.user)
					window.close();										// only close on valid user
				}
			})
	}

	private signInEmail(provider: IProvider, email: string, password: string) {
		return this.store.dispatch(new LoginEmail(email, password));
	}

	private signInPhone(provider: IProvider) { }
	private signInPlay(provider: IProvider) { }
	private signInAnon(provider: IProvider) { }
}
