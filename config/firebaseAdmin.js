const admin = require('firebase-admin');

const serviceAccount = require('./bbs-conversations-firebase-adminsdk-wwyy5-2b7ccc8f97.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://databaseurl.firebaseio.com',
});

module.exports = admin;
