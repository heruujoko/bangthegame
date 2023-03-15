const passport = require('passport');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

var roomId;

const roomSchema = new mongoose.Schema({
  room_id: {type: String, required: true},
  players: {type: Number, default: 0},
  open: {type: Boolean, default: true},
  has_capacity: { type: Boolean, default: true },
  has_started: { type: Boolean, default: false }
})

var Room = mongoose.model('Room', roomSchema);

function main(app, myDataBase) {
  app.route('/').get((req, res) => {
    if (req.isAuthenticated()) {
      res.render('pug', { title: '', message: '', showLogin: false, showCreateGame: true });
    } else {
      res.render('pug', { title: '', message: '', showLogin: true });
    }
  });
  app.route('/create').post(ensureAuthenticated, (req, res) => { 
    roomId = (Math.floor(1000 + Math.random() * 9000)).toString();
    let room = new Room({
      room_id: roomId,
      open: true,
      has_capacity: true,
      has_started: false
    })
    if (!req.body.allow) {
      room.open = false;
    }
    room.save();
    res.redirect(`/game?id=${roomId}`);
  });
  app.route('/join-rand').post(ensureAuthenticated, (req, res) => {
    Room.findOne({ open: true, has_capacity: true, has_started: false })
        .sort('-players')
        .exec((err, gameRoom) => {
      if (err) { console.log(err); }
      if (!gameRoom) { return res.render('pug', { title: '', message: 'No available room found', showLogin: false, showCreateGame: true }); }
      roomId = gameRoom.room_id;
      res.redirect(`/game?id=${roomId}`);
    })
  });
  app.route('/join-id').post(ensureAuthenticated, (req, res) => {
    roomId = req.body.gameId;
    Room.findOne({ room_id: roomId, has_capacity: true, has_started: false }, (err, data) => {
      if (err) { console.log(err); }
      if (!data) { return res.render('pug', { title: '', message: `No available room found with ID ${roomId}`, showLogin: false, showCreateGame: true }); }
      res.redirect(`/game?id=${roomId}`);
    })
  });
  app.route('/game').get(ensureAuthenticated, (req, res) => {
    res.render('pug/game', { user: req.user });
  });
  app.route('/rules')
    .get(ensureAuthenticated, (req, res) => {
      res.render('pug/rules');
    })
    .post(ensureAuthenticated, (req, res) => {
      res.redirect('/rules');
    });
  app.route('/logout').get((req, res, done) => {
    if (req.user != undefined) {
      myDataBase.findOneAndDelete({ username: req.user.username }, function (err, user) {
        if (err) { console.log(err); }
      })
    }
    req.logout();
    res.redirect('/');
  });
  app.route('/login').post((req, res, next) => {
    const hash = bcrypt.hashSync(req.body.password, 12);
    myDataBase.findOne({ username: req.body.username }, function (err, user) {
      if (err) {
        next(err);
      } else if (user) {
        res.render('pug', { title: '', message: `The name '${req.body.username}' is in use.`, showLogin: true });
      } else {
        myDataBase.insertOne({ username: req.body.username, password: hash }, (err, doc) => {
          if (err) {
            res.redirect('/');
          } else {
            next(null, doc.ops[0]);
          }
        });
      }
    });
    },
    passport.authenticate('local', { failureRedirect: '/' }),
    (req, res) => {
      async function authCheck() {
        await req.isAuthenticated();
      }
      authCheck();
      res.redirect('/');
    }
  );
  app.use((req, res, next) => {
    if (req.user != undefined) {
      myDataBase.findOneAndDelete({ username: req.user.username }, function (err, user) {
        if (err) { console.log(err); }
      })
    }
    res.status(404).type('text').send('Not Found');
  });
};

async function remove(myDataBase, removedUser) {
  await myDataBase.findOneAndDelete({ username: removedUser }, function(err, doc) {
    if (err) { console.log(err); }
  })
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

function getRoomId() {
  return roomId;
}

async function gameOn(id) {
  await Room.findOneAndUpdate({ room_id: id }, { has_started: true }, (err, gameRoom) => {
    if (err) { console.log(err); }
  })
}

async function noCapacity(id) {
  await Room.findOneAndUpdate({ room_id: id }, { has_capacity: false }, (err, gameRoom) => {
    if (err) { console.log(err); }
  })
}

async function addPlayer(id) {
  await Room.findOneAndUpdate({ room_id: id }, {$inc: {players: +1}}, (err, gameRoom) => {
    if (err) { console.log(err); }
  })
}

async function removePlayer(id) {
  await Room.findOneAndUpdate({ room_id: id }, {$inc: {players: -1}}, (err, gameRoom) => {
    if (err) { console.log(err); }
  })
}

async function removeRoom(id) {
  await Room.findOneAndDelete({ room_id: id }, (err, gameRoom) => {
    if (err) { console.log(err); }
  })
}


exports.main = main;
exports.getRoomId = getRoomId;
exports.remove = remove;
exports.gameOn = gameOn;
exports.noCapacity = noCapacity;
exports.addPlayer = addPlayer;
exports.removePlayer = removePlayer;
exports.removeRoom = removeRoom;