import { Injectable } from '@angular/core';
import { map, switchMap, take } from 'rxjs/operators';

import { Store } from '@ngxs/store';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';
import { LoginAction, LoginEvent } from '@dbase/state/auth.action';

import { AuthModule } from '@service/auth/auth.module';
import { getAuthProvider, isActive } from '@service/auth/auth.library';
import type { TScopes, TParams } from '@service/auth/auth.interface';

import { FireService } from '@dbase/fire/fire.service';
import { FIELD, STORE, auth } from '@dbase/data.define';
import type { Provider, Config, CustomClaims } from '@dbase/data.schema';

import { asArray } from '@library/array.library';
import { getConfig } from '@dbase/state/config.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
	#dbg = dbg(this, 'AuthService');
	#auth$ = this.state.getAuthData();

	constructor(private readonly store: Store, private data: DataService, private state: StateService, private fire: FireService) { this.#dbg('new'); }

	get active() {
		return this.#auth$.pipe(
			take(1),
			map(state => isActive(state)),
		)
	}

	get current() {
		return this.#auth$
			.pipe(take(1))
			.toPromise()
			.then(user => user.auth.current)
	}

	get user() {
		return this.#auth$
			.pipe(take(1))
			.toPromise()
	}

	get user$() {
		return this.#auth$;
	}

	get claim$() {
		return this.user$
			.pipe(map(user => user.auth.token?.claims?.customClaims as CustomClaims || {}))
	}

	get roles$() {
		return this.claim$
			.pipe(map(claim => claim.roles || []))
	}

	get isAdmin$() {
		return this.roles$
			.pipe(map(roles => roles.includes(auth.ROLE.Admin)))
	}

	public signOut() {
		this.store.dispatch(new LoginAction.Out());
	}

	public async signIn(provider: Provider, opts: Record<string, any> = {}) {
		const { image, ...rest } = provider;								// drop the <image> for debug
		this.#dbg('signIn: %j', rest);

		switch (provider[FIELD.Type]) {
			case undefined:
			case auth.METHOD.Identity:
				this.signInIdentity(provider);
				break;

			case auth.METHOD.Oauth:
				this.signInOAuth(provider);
				break;

			case auth.METHOD.Oidc:
				this.signInOIDC(provider);
				break;

			case auth.METHOD.Email:
				this.signInEmail(provider, opts.email, opts.password);
				break;

			case auth.METHOD.Play:
				this.signInPlay(provider);
				break;

			case auth.METHOD.Phone:
				this.signInPhone(provider);
				break;

			case auth.METHOD.Anonymous:
				this.signInAnon(provider);
				break;

			case auth.METHOD.Custom:
				this.signInCustom(opts.jwt as string);
				break;

			default:
				this.#dbg('signIn: %s', provider);
				break;
		}
	}

	/** prepare an AuthProvider object before dispatching the SignIn flow */
	private signInIdentity(provider: Provider) {
		const [, authProvider] = getAuthProvider(provider[FIELD.Key]);
		if (!authProvider) return;                      // unsupported providerId

		asArray(provider.scope)
			.forEach(scope => (authProvider as TScopes).addScope(scope));

		asArray(provider.custom)
			.forEach(custom => (authProvider as TScopes).setCustomParameters(custom));

		if (provider.params)
			(authProvider as TParams).setCustomParameters(provider.params);

		return this.store.dispatch(new LoginAction.Identity(authProvider))
	}

	/** This runs in the main thread */
	private async signInOAuth(provider: Provider) {
		const urlQuery = `prefix=${provider.prefix}`;
		const oauth = await this.data.getCurrent<Config>(STORE.Config)
			.then(config => getConfig(config, STORE.Provider, 'oauth'))
			.then(oauth => oauth.value)

		const child = this.openChannel('token');// link to the child popup
		child.onmessage = (msg) => {						// when child sends a message...
			child.close();												// 	close BroadcastChannel
			this.store.dispatch(new LoginEvent.Info({ info: JSON.parse(msg.data) }));
		}

		window.open(`${oauth.request_url}?${urlQuery}`, '_blank', 'height=600,width=400');
	}

	private openChannel(name: string) {
		return new BroadcastChannel(name);
	}

	/** This runs in the OAuth popup */
	public signInToken(response: any) {
		const parent = this.openChannel('token');// link to the parent of this popup
		this.#dbg('signInToken: %j', response);

		return this.store.dispatch(new LoginAction.Token(response.token, response.prefix, response.user))
			.pipe(switchMap(_ => this.#auth$))			// this will fire multiple times, as AuthState settles
			.subscribe(state => {
				if (state.auth.info) 								// tell the parent to update State
					parent.postMessage(JSON.stringify(state.auth.info));

				if (state.auth.user /** && open */)
					window.close();										// only close on valid user
			})
	}

	private signInEmail(provider: Provider, email: string, password: string) {
		return this.store.dispatch(new LoginAction.Email(email, password))
	}

	private signInAnon(provider: Provider) {
		return this.store.dispatch(new LoginAction.Anon())
	}

	private signInCustom(token: string) {
		return this.store.dispatch(new LoginAction.Token(token, auth.PROVIDER.jwt, {}));
	}

	private signInOIDC(provider: Provider) { }
	private signInPhone(provider: Provider) { }
	private signInPlay(provider: Provider) { }


	/** This allows us to logout current Member, and signOn as another */
	public behalf(uid: string) {
		return this.fire.createToken(uid)				// ask Cloud Functions to mint a token on our behalf
			.then(token => {
				const authInfo = { token, prefix: 'local', user: {} };
				this.#dbg('token: %j', token);

				this.signOut();
				return this.signInToken(authInfo)
			})
	}
}
