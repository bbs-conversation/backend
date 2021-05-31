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

app.get('/api/chats', async (req, res) => {
  try {
    let result = await chatRooms.findOne({
      fromUser: req.query.uid,
      toUser: req.query.user,
    });
    if (!result) {
      res.status(404).json({
        success: true,
        status: res.statusCode,
        message: 'No chat history found',
      });
    } else {
      res.status(200).json({
        success: true,
        status: res.statusCode,
        message: 'Chat messages',
        data: result,
      });
    }
  } catch (e) {
    console.error(e.message);
    res
      .status(500)
      .json({ success: false, status: res.statusCode, message: e.message });
  }
});

// Use error handler
app.use(errorHandler);

io.use((socket, next) => {
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

  socket.on('chat-with', async (user) => {
    try {
      const room = await chatRooms.findOne({
        fromUser: socket.token.uid,
        toUser: user,
      });
      if (!room) {
        await chatRooms.insertOne({
          fromUser: socket.token.uid,
          toUser: user,
          messages: [],
        });
      }
      socket.emit('Chat is now being saved with end to end encryption');
      socket.activeChat = user;
    } catch (e) {
      console.error(e);
      socket.emit('message', {
        message: 'An error occured while saving chat',
        recipient: id,
        sender: id,
        type: 'fromServer',
        byUser: 'chat server',
        time: Date.now(),
        channelId: 'all',
      });
    }
  });

  socket.on('send-message', ({ message }) => {
    chatCollection.updateOne(
      {
        fromUser: socket.token.uid,
        toUser: socket.activeChat,
      },
      {
        $push: {
          messages: message,
        },
      }
    );
    socket.broadcast.to(socket.activeChat).emit('message', {
      recipient,
      sender: id,
      message: message,
      type: 'toUser',
      byUser: socket.token.uid,
      time: Date.now(),
      channelId: id,
    });
  });

  socket.on('disconnect_user', () => {
    socket.disconnect(true);
  });
});

let chatRooms;

async function connectMongoDB() {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db('admin').command({ ping: 1 });
    chatRooms = client.db(process.env.MONGO_DB_NAME).collection('chatRooms');
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
