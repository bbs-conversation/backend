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

const cors = require('cors');

const { MongoClient } = require('mongodb');
const authenticated = require('./middlewares/auth');
const recogniseRole = require('./middlewares/recogniseRole');
const counsellors = require('./config/counsellors.json');
const ErrorResponse = require('./utils/errorResponse');
const socketioAuth = require('./middlewares/socketio_auth');

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
      'https://bbs-conversations-students.web.app',
      'https://bbs-conversations-students.netlify.app',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
  },
});

const corsOptions = {
  origin: [
    'https://bbs-conversations-students.web.app',
    'https://bbs-conversations-students.netlify.app',
    'http://localhost:3000',
  ],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Use cors middleware
app.use(cors(corsOptions));

// Use express json parser
app.use(express.json());

// Use api routes
app.use('/api', RESTroutes);

app.get('/api/chats', authenticated, recogniseRole, async (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({
      success: false,
      code: res.statusCode,
      message: 'Please enter the required parameters',
    });
  }
  if (development) console.log(req.role);
  if (req.role !== 'counsellor' && !counsellors.includes(user)) {
    return res.status(403).json({
      success: false,
      code: res.statusCode,
      message: `User can only get history of their counsellors`,
    });
  } else {
    try {
      let result = await chatRooms.findOne({
        users: { $all: [req.token.user_id, user] },
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
          message: result,
        });
      }
    } catch (e) {
      console.error(e.message);
      res.status(500).json({
        success: false,
        status: res.statusCode,
        message: e.message,
      });
    }
  }
});

app.get(
  '/api/chat-rooms',
  authenticated,
  recogniseRole,
  async (req, res, next) => {
    if (req.role !== 'counsellor')
      return next(
        new ErrorResponse('Only counsellors can access the route', 403)
      );
    try {
      let result = await chatRooms.findOne({
        users: { $all: [req.token.user_id] },
      });
      if (!result) {
        res.status(404).json({
          success: true,
          code: res.statusCode,
          message: 'No chat rooms found',
        });
      } else {
        res.status(200).json({
          success: true,
          code: res.statusCode,
          message: result,
        });
      }
    } catch (err) {
      if (development) console.error(err);
      return next(new ErrorResponse(err.message, 500));
    }
  }
);

// Use error handler
app.use(errorHandler);

io.use(socketioAuth);

io.on('connection', (socket) => {
  const id = socket.token.user_id;
  socket.join(id);
  if (development) {
    console.log('A new connection detected with id');
  }

  // socket.emit('message', {
  //   message: 'You are now connected to the server',
  //   time: new Date(),

  //   recipient: id,
  //   senderName: 'Chat Bot',
  // });

  socket.on('chat-with', async ({ user }) => {
    if (development) console.log('fired chat-with event', user);
    if (!socket.token.counsellor && !counsellors.includes(user))
      return socket.emit('message', {
        message: 'You can only chat with a counsellor',
        time: new Date(),
        recipient: id,
        senderName: 'Chat Bot',
      });
    const usersFilter = { users: { $all: [id, user] } };
    try {
      socket.emit('message', {
        message: 'Chat is now being saved with end to end encryption',
        time: new Date(),
        recipient: id,
        senderName: 'Chat Bot',
      });
      const room = await chatRooms.findOne(usersFilter);

      if (!room) {
        await chatRooms.insertOne({
          users: [id, user],
          messages: [],
        });
      }
      socket.activeChat = user;
    } catch (e) {
      console.error(e);
      socket.emit('message', {
        message: 'An error occured while saving chat',
        time: new Date(),
        senderName: 'Chat Bot',
        recipient: id,
      });
    }
  });

  socket.on('send-message', ({ message }) => {
    if (!socket.activeChat)
      return socket.emit('message', {
        message: 'Please select a user',
        time: new Date(),
        senderName: 'Chat Bot',
        recipient: id,
      });
    const usersFilter = { users: { $all: [id, socket.activeChat] } };
    chatRooms.updateOne(usersFilter, {
      $push: {
        messages: {
          message: message,
          time: new Date(),
          sender: id,
          senderName: socket.token.name,
          recipient: socket.activeChat,
        },
      },
    });
    socket.broadcast.to(socket.activeChat).emit('message', {
      message: message,
      time: new Date(),
      senderName: socket.token.name,
      sender: id,
      recipient: socket.activeChat,
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
