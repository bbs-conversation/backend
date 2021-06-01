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

const development = process.env.NODE_ENV !== 'production' || false;

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
      'https://amritb.github.io',
    ],
    methods: ['GET', 'POST'],
  },
});

// Use express json parser
app.use(express.json());

// Use api routes
app.use('/api', RESTroutes);

app.get('/api/chats', async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    res.status(400).json({
      success: false,
      code: res.statusCode,
      message: 'Please enter the required parameters',
    });
  } else {
    try {
      let result = await chatRooms.findOne({
        users: { $all: [user1, user2] },
      });
      if (!result) {
        res.status(404).json({
          success: true,
          code: res.statusCode,
          message: 'No chat history found',
        });
      } else {
        res.status(200).json({
          success: true,
          code: res.statusCode,
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
  const id = socket.token.user_id;
  socket.join(id);
  if (development) {
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
    const usersFilter = { users: { $all: [id, user] } };
    try {
      const room = await chatRooms.findOne(usersFilter);
      if (!room) {
        await chatRooms.insertOne({
          users: [id, user],
          messages: [],
        });
      }
      socket.emit('message', {
        message: 'Chat is now being saved with endto end encryption',
        recipient: id,
        sender: id,
        type: 'fromServer',
        byUser: 'chat server',
        time: Date.now(),
        channelId: 'all',
      });
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
    const usersFilter = { users: { $all: [id, socket.activeChat] } };
    chatRooms.updateOne(usersFilter, {
      $push: {
        messages: {
          message: message,
          time: new Date(),
          sender: id,
          recipient: socket.activeChat,
        },
      },
    });
    socket.broadcast.to(socket.activeChat).emit('message', {
      recipient: socket.activeChat,
      sender: id,
      message: message,
      type: 'toUser',
      byUser: id,
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
