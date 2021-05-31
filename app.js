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
const admin = require('./config/firebaseAdmin');

const { MongoClient } = require('mongodb');
const { exit } = require('process');

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('Please specify MongoDB URI');
}

// Create a new MongoClient
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://bbs-conversations-students.netlify.app',
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
  if (NODE_ENV !== 'production') {
    console.log('A new connection detected with id');
  }

  socket.emit('message', {
    message: 'You are now connected',
    recipient: id,
    sender: id,
    type: 'fromServer',
    byUser: 'chat server',
    time: Date.now(),
    channelId: 'all',
  });

  socket.on('send-message', ({ recipient, text, byUser }) => {
    socket.broadcast.to(recipient).emit('message', {
      recipient,
      sender: id,
      message: text,
      type: 'toUser',
      byUser,
      time: Date.now(),
      channelId: id,
    });
  });

  socket.on('disconnect_user', () => {
    socket.disconnect(true);
  });
});

let chatCollection;

async function connectMongoDB() {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db('admin').command({ ping: 1 });
    chatCollection = client
      .db(process.env.MONGO_DB_NAME)
      .collection('counsellors');
    chatCollection = client
      .db(process.env.MONGO_DB_NAME)
      .collection('chatRooms');
    console.log('Connected successfully to server');
  } catch (err) {
    console.log(err.message);
    process.exit(1);
  }
}

const port = process.env.PORT || 5000;
server.listen(port, () => {
  connectMongoDB().then(() =>
    console.log(`Listening on port ${port} in ${process.env.NODE_ENV} mode`)
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error [UHP]: ${err.message}`);
  // Close server connection
  server.close(() => process.exit(1));
});

// End all
