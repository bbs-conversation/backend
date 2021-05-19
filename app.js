const express = require('express');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const RESTroutes = require('./routes');
const errorHandler = require('./middlewares/errors');
const server = http.createServer(app);
const dotenv = require('dotenv');

// Dotenv config
dotenv.config({
  path: './config.env',
});

const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Use api routes
app.use('/api', RESTroutes);

// Use error handler
app.use(errorHandler);

io.on('connection', (socket) => {
  const id = socket.handshake.query.id;
  socket.join(id);
  console.log('A new connection detected');

  socket.emit('message', {
    message: 'you are now connected',
    recipients: [id],
    sender: id,
    type: 'fromServer',
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

  // socket.on('disconnect', () => {
  //   io.emit('A user has left the chat');
  // });
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
