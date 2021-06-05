const admin = require('../config/firebaseAdmin');

const socketioAuth = (socket, next) => {
  const token = socket.handshake.query.token;
  const error = new Error('not_authorized');
  if (token) {
    admin
      .auth()
      .verifyIdToken(token)
      .then((token) => {
        socket.token = token;
        next();
      })
      .catch((err) => {
        console.error(err);
        socket.emit('message', {
          message:
            'Either your token is invalid, or you session has expired please refresh the page to retry',
          time: new Date(),
          senderName: 'Chat Bot',
          recipient: id,
        });
        next(error);
        socket.disconnect(false);
      });
  } else {
    next(error);
    socket.disconnect(false);
  }
};

module.exports = socketioAuth;
