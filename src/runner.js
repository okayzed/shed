
var child_process = require("child_process");

var EOF = "";

function compileOkp(text, cb) {
  var proc = child_process.spawn("docker",
    ["run", "-i", "-m", "100M", "shed/runner", "okp", "-", "-p"],
    { shell: true, timeout: 6000 });



  proc.on('exit', function() {
    cb(stdout.join("\n"));
  });

  proc.stdin.write(text + "\n");
  proc.stdin.end();
  var stdout = [];
  var stderr = [];
  // put the code into a tmp file?
  proc.stdout.on("data", function(data) {
    stdout.push(data.toString());
  });
  // put the code into a tmp file?
  proc.stderr.on("data", function(data) {
    stderr.push(data.toString());
  });

}

function runCode(room, code, lang, stdin, socket, saveRunHistory) {
  var this_socket = socket;

  var lines = []
  lines.push(code);

  stdin = stdin || "";


  var lang_runner = "/opt/shed/" + lang + ".sh";

  var proc = child_process.spawn("docker",
    ["run", "-i", "-m", "100M", "--cpu-quota", "20000", "shed/runner", lang_runner],
    { shell: true, timeout: 6000 });

  proc.on('exit', function() {
    console.log("FINISHED RUNNING PROGRAM");
    lines = stdout.join('').split('\n');

    var results = [];
    // filter out WARNING from docker cgroup crap
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("WARNING: Your kernel") == -1) {
        results.push(lines[i] + "\n");
      }
    }
    var codeOutput = results.join('').trim();
    socket.broadcast.in(room).emit("ran", codeOutput, stderr);
    socket.emit("ran", codeOutput, stderr);
    saveRunHistory(room, codeOutput);
  });


  proc.stdin.write(lines.join('\n'));
  proc.stdin.write(EOF);
  proc.stdin.write(stdin);
  proc.stdin.write(EOF);
  proc.stdin.end();

  var stdout = [];
  var stderr = [];
  // put the code into a tmp file?
  proc.stdout.on("data", function(data) {
    stdout.push(data.toString());
  });
  // put the code into a tmp file?
  proc.stderr.on("data", function(data) {
    stdout.push(data.toString());
  });

  // 10 second timeout in case someone tries to forkbomb
  var timeout = 10000;
  setTimeout(function() {
    proc.kill();
  }, timeout);

}

function runDoc(room, doc, stdin, socket, cb) {
  socket.broadcast.in(room).emit("output", "> Running...\n")
  socket.emit("output", "> Running...\n")
  console.log("RUNNING PROGRAM");

  if (doc.filetype == "okp") {
    compileOkp(doc.text, function(code) {
      runCode(room, code, "cpp", stdin, socket);
    });
  } else {
    runCode(room, doc.text, doc.filetype, stdin, socket, cb);
  }

}

var REPLAY_ROOM = "xx:REPLAYS:xx";
function runReplay(code, filetype, stdin, socket) {
  socket.emit("output", "> Running...\n")
  if (filetype == "okp") {
    compileOkp(code, function(code) {
      runCode(REPLAY_ROOM, code, "cpp", stdin, socket);
    });
  } else {
    runCode(REPLAY_ROOM, code, filetype, stdin, socket);
  }
}

module.exports = {
  runDoc: runDoc,
  runReplay: runReplay
}
