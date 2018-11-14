import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { Store, Select } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';
import { StateService } from '@dbase/state/state.service';

import { AuthModule } from '@dbase/auth/auth.module';
import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { LoginIdentity, Logout, IAuthState, LoginEmail, LoginOAuth, LoginAdditionalInfo } from '@dbase/state/auth.define';

import { FIELD } from '@dbase/data/data.define';
import { IProvider, IConfig } from '@dbase/data/data.schema';
import { TScopes, TParams } from '@dbase/auth/auth.interface';

import { IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
	@Select() auth$!: Observable<IAuthState>;

	private dbg: Function = dbg.bind(this);
	private urlRequest!: IConfig;

	constructor(private readonly store: Store, private state: StateService) {
		this.dbg('new');
		this.state.getConfigData('oauth')
			.subscribe(oauth => this.urlRequest = oauth.value.request_url);
	}

	get isAuth() {
		return this.auth$.pipe(
			map(auth => isActive(auth))
		)
	}

	public authState() {
		return this.store
			.selectSnapshot<IAuthState>(state => state[SLICE.auth]);
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
	private signInOAuth(provider: IProvider) {
		const urlQuery = `prefix=${provider.prefix}`;

		window.open(`${this.urlRequest}?${urlQuery}`, '_blank', 'height=600,width=400');

		new BroadcastChannel('oauth')
			.onmessage = (msg) => this.store.dispatch(new LoginAdditionalInfo({ info: JSON.parse(msg.data) }))
	}

	/** This runs in the OAuth popup */
	public signInToken(response: any) {
		return this.store.dispatch(new LoginOAuth(response.token, response.prefix, response.user))
			.pipe(switchMap(_ => this.auth$))			// this will fire multiple times, as AuthState settles
			.subscribe(auth => {
				const channel = new BroadcastChannel('oauth');
				if (auth.info)											// tell the main thread to update State
					channel.postMessage(JSON.stringify(auth.info));

				if (auth.user) {
					channel.close();
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
