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

const cors = require('cors');

const authenticated = require('./middlewares/auth');
const recogniseRole = require('./middlewares/recogniseRole');
const counsellors = require('./config/counsellors.json');
const ErrorResponse = require('./utils/errorResponse');
const socketioAuth = require('./middlewares/socketio_auth');
const xss = require('xss-clean');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const socketioCallback = require('./routes/socketioCallback');
const client = require('./config/mongoClient');

const development = process.env.NODE_ENV !== 'production' || false;

let corsOrigin = [];
if (!development) corsOrigin.push('https://bbs-conversations-students.web.app');
if (development) corsOrigin.push('http://localhost:3000');

const io = socketIo(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

const corsOptions = {
  origin: corsOrigin,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Use cors middleware
app.use(cors(corsOptions));

// Use helmet for headers
app.use(helmet());

// Use express json parser
app.use(express.json());

// Sanitize mongodb data
app.use(mongoSanitize());

// Use XSS Clean middleware
app.use(xss());

// Use api routes
app.use('/api', RESTroutes);

app.get('/api/chats', authenticated, recogniseRole, async (req, res, next) => {
  const { user } = req.query;
  if (!user) {
    return next(new ErrorResponse('Please enter the required parameters', 400));
  }
  if (user === req.token.user_id)
    return next(new ErrorResponse('Users can only chat with others', 400));
  if (development) console.log(req.role);
  if (req.role !== 'counsellor' && !counsellors.includes(user))
    return next(
      new ErrorResponse('User can only get history of their counsellors', 403)
    );
  else {
    try {
      let result = await chatRooms.findOne({
        users: { $all: [req.token.user_id, user] },
      });
      if (!result) return next(new ErrorResponse('No chat history found', 404));
      else {
        res.status(200).json({
          success: true,
          code: res.statusCode,
          message: result,
        });
      }
    } catch (e) {
      console.error(e.message);
      return next(new ErrorResponse(e.message, 500));
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
      let result = await chatRooms.find({
        users: req.token.user_id,
      });
      if (result) {
        result.toArray(function (err, result) {
          if (err) return next(new ErrorResponse(err, 500));

          res.status(200).json({
            success: true,
            code: res.statusCode,
            message: result,
          });
          if (!result)
            res.status(404).json({
              success: true,
              code: res.statusCode,
              message: 'No chat rooms found',
            });
        });
      } else {
        res.status(404).json({
          success: true,
          code: res.statusCode,
          message: 'No chat rooms found',
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

io.on('connection', socketioCallback);

let chatRooms;

async function connectMongoDB() {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db('admin').command({ ping: 1 });
    chatRooms = client.db(process.env.MONGO_DB_NAME).collection('chatRooms');
    console.log('Connected successfully to server: express');
  } catch (err) {
    console.error(err.message);
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
  console.error(`Error [UHP]: ${err.message}`);
  // Close server connection
  server.close(() => process.exit(1));
});

// End all
