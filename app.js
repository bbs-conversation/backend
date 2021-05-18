const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const RESTroutes = require('./routes');
const errorHandler = require('./middlewares/errors');
const server = http.createServer(app);
const io = socketIo(server);
const app = express();

// Use api routes
app.use('/api', RESTroutes);

// Use error handler
app.use(errorHandler);

let users = [];
io.on('connection', (socket) => {});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Listening on port ${port}`));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error [UHP]: ${err.message}`);
  // Close server connection
  server.close(() => process.exit(1));
});

// End all
