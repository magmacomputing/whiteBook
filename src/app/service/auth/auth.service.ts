import { Injectable } from '@angular/core';
import { map, switchMap, take } from 'rxjs/operators';

import { Store } from '@ngxs/store';
import { StateService } from '@dbase/state/state.service';
import { LoginIdentity, Logout, LoginEmail, LoginToken, AuthInfo, LoginAnon } from '@dbase/state/auth.action';

import { AuthModule } from '@service/auth/auth.module';
import { getAuthProvider, isActive } from '@service/auth/auth.library';
import { TScopes, TParams } from '@service/auth/auth.interface';

import { FireService } from '@dbase/fire/fire.service';
import { FIELD, STORE, Auth } from '@dbase/data/data.define';
import { IProvider, IConfig } from '@dbase/data/data.schema';

import { asArray } from '@lib/array.library';
import { getConfig } from '@library/config.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
	private auth$ = this.state.getAuthData();
	private dbg = dbg(this);

	constructor(private readonly store: Store, private state: StateService, private fire: FireService) { this.dbg('new'); }

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

	get current() {
		return this.auth$
			.pipe(take(1))
			.toPromise()
			.then(user => user.auth.current)
	}

	public signOut() {
		this.store.dispatch(new Logout());
	}

	public async signIn(provider: IProvider, opts: Record<string, any> = {}) {
		this.dbg('signIn: %j', provider);

		switch (provider[FIELD.type]) {
			case undefined:
			case Auth.METHOD.identity:
				this.signInIdentity(provider);
				break;

			case Auth.METHOD.oauth:
				this.signInOAuth(provider);
				break;

			case Auth.METHOD.oidc:
				this.signInOIDC(provider);
				break;

			case Auth.METHOD.email:
				this.signInEmail(provider, opts.email, opts.password);
				break;

			case Auth.METHOD.play:
				this.signInPlay(provider);
				break;

			case Auth.METHOD.phone:
				this.signInPhone(provider);
				break;

			case Auth.METHOD.anonymous:
				this.signInAnon(provider);
				break;

			default:
				this.dbg('signIn: %s', provider);
				break;
		}
	}

	/** prepare an AuthProvider object before dispatching the SignIn flow */
	private signInIdentity(provider: IProvider) {
		const [, authProvider] = getAuthProvider(provider[FIELD.key]);
		if (!authProvider) return;                      // unsupported providerId

		asArray(provider.scope)
			.forEach(scope => (authProvider as TScopes).addScope(scope));

		asArray(provider.custom)
			.forEach(custom => (authProvider as TScopes).setCustomParameters(custom));

		if (provider.params)
			(authProvider as TParams).setCustomParameters(provider.params);

		return this.store.dispatch(new LoginIdentity(authProvider))
	}

	/** This runs in the main thread */
	private async signInOAuth(provider: IProvider) {
		const urlQuery = `prefix=${provider.prefix}`;
		const oauth = await this.state.asPromise(this.state.getCurrent<IConfig>(STORE.config))
			.then(config => getConfig(config, 'oauth'))
			.then(oauth => oauth.value)

		const child = this.openChannel('token');// the child popup
		child.onmessage = (msg) => {						// when child sends a message...
			child.close();												// 	close BroadcastChannel
			this.store.dispatch(new AuthInfo({ info: JSON.parse(msg.data) }));
		}

		window.open(`${oauth.request_url}?${urlQuery}`, '_blank', 'height=600,width=400');
	}

	private openChannel(name: string) {
		return new BroadcastChannel(name);
	}

	/** This runs in the OAuth popup */
	public signInToken(response: any) {
		this.dbg('signInToken: %j', response);
		const parent = this.openChannel('token');// the parent of this popup

		return this.store.dispatch(new LoginToken(response.token, response.prefix, response.user))
			.pipe(switchMap(_ => this.auth$))			// this will fire multiple times, as AuthState settles
			.subscribe(state => {
				if (state.auth.info) 								// tell the parent to update State
					parent.postMessage(JSON.stringify(state.auth.info));

				if (state.auth.user) //&& open) {
					window.close();										// only close on valid user
			})
	}

	private signInEmail(provider: IProvider, email: string, password: string) {
		return this.store.dispatch(new LoginEmail(email, password))
	}

	private signInAnon(provider: IProvider) {
		return this.store.dispatch(new LoginAnon())
	}

	private signInOIDC(provider: IProvider) { }
	private signInPhone(provider: IProvider) { }
	private signInPlay(provider: IProvider) { }


	/** This allows us to logout current Member, and signOn as another */
	public behalf(uid: string) {
		return this.fire.createToken(uid)				// ask Cloud Functions to mint a token on our behalf
			.then(token => {
				const authInfo = { token, prefix: 'local', user: {} };
				this.dbg('token: %j', token);

				this.signOut();
				return this.signInToken(authInfo)
			})
	}
}
