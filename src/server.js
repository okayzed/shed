var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var randomName = require('./client/js/Randomizer.js');

var runDoc = require("./runner").runDoc;
var runReplay = require("./runner").runReplay;
var Post = require("./models").Post;
var PostOp = require("./models").PostOp;
var getPostOps = require("./models").getPostOps;
var Chat = require("./models").Chat;
var path = require('path');
var ejs = require('ejs');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('html', ejs.renderFile);

var path = __dirname + "/../users.htpasswd"
try {
  if (!fs.existsSync(path)) {
    // touch users.htpasswd
    console.log("Creating blank users.htpasswd");
    fs.closeSync(fs.openSync(path, 'w'));
  }
} catch(err) { }

var auth = require('http-auth');
var basic = auth.basic({
    realm: "Shed Protected Area",
    file: path
});

function randid() {
  var i = parseInt(Math.random() * (1e9+7))
  return i.toString(16);
}

app.get('/', function(req, res) {
  var name = process.env.NAME || "";
  res.render('welcome.html', { name: name});
});

app.get('/all', auth.connect(basic), function(req, res) {
  Post.findAll().then(function(posts) {
    posts.reverse()
    res.render('all.html', {posts: posts});

  });
});

app.get('/new', function(req, res) {
  res.redirect('/p/' + randid());
});

app.get('/p/:id', function(req, res){
  res.render('index.html', { docId: req.params.id });
});

app.get('/r/:id', function(req, res){
  res.render('replay.html', { docId: req.params.id });
});

// setting up static directories
app.use('/codemirror', express.static('node_modules/codemirror'));
app.use('/dist', express.static('src/client/dist'));
app.use('/js', express.static('src/client/js'));

var port = process.env.PORT || 3301;
http.listen(port, function(){
  console.log('listening on *:' + port);
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

    server.on("operation", function(op) {
      if (!op) {
        return;
      }

      op.type = "op";
      addChange(room, op);
    });
    // server.on("selection", function(clientId, selection) {
    //   addChange(room, { clientId: clientId, selection: selection, type: "selection"});
    // });
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

function addChange(randid, operation, cb) {
  PostOp.create({ randid: randid, change: operation });
}

function addChat(randid, text) {
  Chat.create({ randid: randid, text: text });
}


io.on('connection', function(socket) {
  var _room, _stdin;
  socket.on("join", function(room) {
    _room = room;
    socket.name = randomName();
    socket.broadcast.in(_room).emit("output",socket.name+" user joined.<br>");
    var server = getRoom(room, function(server) {
      server.addClient(socket);
      server.getClient(socket.id).name = socket.name;

      getDoc(room, function(doc) {
        socket.emit("set_language", doc.filetype);
        socket.emit("stdin", doc.stdin);
      });
    });
    Chat.findAll({where:{randid:room}}).then(function(texts) {
      for (var t in texts) {
        var text = texts[t];
        socket.emit("chat", text.text);
      }
    });
  });

  socket.on("run", function(room, stdin) {
    getDoc(room, function(doc) {
      runDoc(room, doc, stdin, socket);
    });
  });

  socket.on("runReplay", function(code, lang, stdin) {
    runReplay(code, lang, stdin, socket);
  });

  socket.on("get_language", function(docId) {
    getDoc(docId, function(doc) {
      socket.emit("set_language", doc.filetype);
    });
  });

  socket.on("set_language", function(lang) {
    var room = _room;
    socket.broadcast.in(room).emit("set_language", lang);
    getDoc(room, function(doc) {
      doc.filetype = lang;
      doc.save();
    });
  });

  socket.on("chat", function(text) {
    var name = socket.name;
    text = name+": "+text;
    socket.broadcast.in(_room).emit("chat", text);
    socket.emit("chat", text);
    addChat(_room, text);
  });

  socket.on("stdin", function(stdin) {
    _stdin = stdin;
    socket.broadcast.in(_room).emit("stdin", stdin);
    getDoc(_room, function(doc) {
      doc.stdin = _stdin;
      doc.save();
    });
  });

  socket.on("replay", function(room) {
    getPostOps(room, function(changes) {
      socket.emit("replay", changes);
    });
  });
});
