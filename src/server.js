var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var runDoc = require("./runner").runDoc;
var Post = require("./models").Post;

// TODO: allow for different pastes based on routing
app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});

// setting up static directories
app.use('/codemirror', express.static('node_modules/codemirror'));
app.use('/dist', express.static('src/dist'));

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var EditorSocketIOServer = require('./ot.js/editor-socketio-server.js');
var _rooms = {};
function getRoom(room, cb) {
  if (_rooms[room]) {
    return cb(_rooms[room]);
  }

  // so we make a server for each room. that makes sense to me, i guess
  // TODO: load the doc.text from sequelize
  getDoc(room, function(doc) {
    var server = new EditorSocketIOServer(doc.text, [], room);
    var _text = doc.text;
    server.on("changed", function(text) {
      _text = text;
      getDoc(room, function(doc) {
        doc.text = _text;
        doc.save();
      });
    });
    _rooms[room] = server;

    cb(server);
  });

}

function getDoc(randid, cb) {
  var defaults = { text: "", filetype: "javascript" };
  Post.findOrCreate({ where: { randid: randid }, defaults: defaults }).then(function(posts) {
    cb(posts[0]);
  });
}


io.on('connection', function(socket) {
  var _room;
  socket.on("join", function(room) {
    _room = room;
    var server = getRoom(room, function(server) {
      server.addClient(socket);

      getDoc(room, function(doc) {
        socket.emit("set_language", doc.filetype);
      });
    });
  });

  socket.on("run", function(room, stdin) {
    getDoc(room, function(doc) {
      console.log("RUNNING", room);
      runDoc(room, doc, stdin, socket);
    });
  });

  socket.on("set_language", function(lang) {
    var room = _room;
    socket.broadcast.in(room).emit("set_language", lang);
    getDoc(room, function(doc) {
      console.log("SET FILETYPE", lang);
      doc.filetype = lang;
      doc.save();
    });
  });
});
