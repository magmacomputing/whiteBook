// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
	production: true,

	firebase: {
		dev: {
			apiKey: "AIzaSyCQt465v9SVXfKE2gi5kHxWgExYyiXbQXQ",
			authDomain: "whitefire-dev.firebaseapp.com",
			databaseURL: "https://whitefire-dev.firebaseio.com",
			projectId: "whitefire-dev",
			storageBucket: "whitefire-dev.appspot.com",
			messagingSenderId: "919087826501",
		},
		prod: {
			apiKey: "AIzaSyCYo4FvLtznrNtM-I73vzBjTSuyVXebqVI",
			authDomain: "whitefire-51840.firebaseapp.com",
			databaseURL: "https://whitefire-51840.firebaseio.com",
			projectId: "whitefire-51840",
			storageBucket: "whitefire-51840.appspot.com",
			messagingSenderId: "241706183908",
			appId: "1:241706183908:web:2e684f93d2af915e"
		},

		config: {
			name: 'whiteFire',
			region: 'us-central1',
			automaticDataCollectionEnabled: true,
		}
	}
}

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
