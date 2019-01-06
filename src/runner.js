var child_process = require("child_process");

var EOF = "";

function runDoc(room, doc, stdin, socket) {

    var this_socket = socket;

    var t = doc.text;
    var lang = doc.filetype;

    var lines = []
    lines.push(t);

    stdin = stdin || "";

    console.log("RUNNING PROGRAM");
    socket.broadcast.in(room).emit("output", "> Running...\n")
    socket.emit("output", "> Running...\n")

    // TODO: allow stdin to be provided
    var lang_runner = "/opt/shed/" + lang + ".sh";

    var proc = child_process.spawn("docker",
      ["run", "-i", "-m", "100M", "--cpu-quota", "10000", "shed/runner", lang_runner],
      { shell: true, timeout: 6000 });

    proc.on('exit', function() {
      console.log("FINISHED RUNNING PROGRAM");
      lines = stdout.join('').split('\n');

      var results = [];
      // filter out WARNING from docker cgroup crap
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("WARNING: Your kernel") == -1) {
          results.push(lines[i]);
        }
      }

      socket.broadcast.in(room).emit("ran", results, stderr);
      socket.emit("ran", results, stderr);
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
}

module.exports = {
  runDoc: runDoc
}
