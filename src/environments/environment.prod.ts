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