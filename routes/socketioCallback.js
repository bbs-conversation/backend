const Filter = require('bad-words');
const client = require('../config/mongoClient');
const counsellors = require('../config/counsellors');

const development = process.env.NODE_ENV !== 'production' || false;
const filter = new Filter();
let chatRooms;

const connectDb = async () => {
  try {
    // Connect the client to the server
    await client.connect();
    chatRooms = client.db(process.env.MONGO_DB_NAME).collection('chatRooms');
    console.log('Connected successfully to server: socketio');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

connectDb();

const socketioCallback = (socket) => {
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
    if (socket.token.user_id === user) {
      socket.activeChat = undefined;
      return socket.emit('message', {
        message: 'Users can only chat with others',
        time: new Date(),
        recipient: id,
        senderName: 'Chat Bot',
      });
    }
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
        if (socket.token.counsellor === true) {
          socket.activeChat = undefined;
          return socket.emit('message', {
            message: 'Only student can start a conversation',
            time: new Date(),
            recipient: id,
            senderName: 'Chat Bot',
          });
        } else {
          await chatRooms.insertOne({
            users: [id, user],
            messages: [],
            name: socket.token.name,
          });
        }
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
          message: filter.clean(message),
          time: new Date(),
          sender: id,
          senderName: socket.token.name,
          recipient: socket.activeChat,
        },
      },
    });
    socket.broadcast.to(socket.activeChat).emit('message', {
      message: filter.clean(message),
      time: new Date(),
      senderName: socket.token.name,
      sender: id,
      recipient: socket.activeChat,
    });
  });

  socket.on('disconnect_user', () => {
    socket.disconnect(true);
  });
};

module.exports = socketioCallback;
