// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  firebase: {
    app: {
      apiKey: "AIzaSyCQt465v9SVXfKE2gi5kHxWgExYyiXbQXQ",
      authDomain: "whitefire-dev.firebaseapp.com",
      databaseURL: "https://whitefire-dev.firebaseio.com",
      projectId: "whitefire-dev",
      storageBucket: "whitefire-dev.appspot.com",
      messagingSenderId: "919087826501",
    },

    config: {
      name: 'whiteFire',
      automaticDataCollectionEnabled: true,
      timestampsInSnapshots: true,
    }
  }
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
