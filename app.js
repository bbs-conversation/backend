const express = require('express');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const RESTroutes = require('./routes');
const errorHandler = require('./middlewares/errors');
const server = http.createServer(app);
const dotenv = require('dotenv');
const admin = require('./config/firebaseAdmin');

// Dotenv config
dotenv.config({
  path: './config.env',
});

const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://bbs-conversations-students.web.app',
    ],
    methods: ['GET', 'POST'],
  },
});

// Use express json parser
app.use(express.json());

// Use api routes
app.use('/api', RESTroutes);

// Use error handler
app.use(errorHandler);

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  const error = new Error('not_authorized');
  if (token) {
    admin
      .auth()
      .verifyIdToken(token)
      .then((token) => next())
      .catch((err) => {
        console.error(err);
        next(error);
        socket.disconnect(false);
      });
  } else {
    next(error);
    socket.disconnect(false);
  }
});
io.on('connection', (socket) => {
  const id = socket.handshake.query.id;
  socket.join(id);
  console.log('A new connection detected');

  socket.emit('message', {
    message: 'You are now connected',
    recipients: [id],
    sender: id,
    type: 'fromServer',

    channelId: 'all',
  });

  socket.on('send-message', ({ recipients, text }) => {
    recipients.forEach((recipient) => {
      const newRecipients = recipients.filter((r) => r !== recipient);
      newRecipients.push(id);
      socket.broadcast.to(recipient).emit('message', {
        recipients: newRecipients,
        sender: id,
        message: text,
        type: 'toUser',
      });
    });
  });

  socket.on('disconnect_user', () => {
    socket.disconnect(true);
  });

  socket.on('disconnect', () => {
    socket.emit('message', {
      message: 'You have been disconnected from the server',
      recipients: [id],
      sender: id,
      type: 'fromServer',

      channelId: 'all',
    });
  });
});

const port = process.env.PORT || 5000;
server.listen(port, () =>
  console.log(`Listening on port ${port} in ${process.env.NODE_ENV} mode`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error [UHP]: ${err.message}`);
  // Close server connection
  server.close(() => process.exit(1));
});

// End all
