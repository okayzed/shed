var socket = io()
var docId = "main";
var cm;

function setLang(mode) {
  var langEl = $(".language");
  if (mode != langEl.val()) {
    langEl.val(mode);
  }

  var md = CodeMirror.findModeByName(mode);
  cm.setOption("mode", md.mime);
  CodeMirror.autoLoadMode(cm, md.mode);

}

function setTheme(mode) {
  cm.setOption("theme", mode);
}

function setKeymap(mode) {
  cm.setOption("keyMap", "vim");
}

function runCode() {
  socket.emit("run", docId);
}

// socket stuff

socket.emit("join", docId);

socket.on("doc", function(data) {
  cm = CodeMirror.fromTextArea(document.getElementById("note"), {lineNumbers: true})
  cm.setValue(data.str)
  var serverAdapter = new ot.SocketIOAdapter(socket)
  var editorAdapter = new ot.CodeMirrorAdapter(cm)
  var client = new ot.EditorClient(data.revision, data.clients, serverAdapter, editorAdapter)

  setTheme("monokai");
});

socket.on("output", function(output) {
  console.log("OUTPUT", output);
  var pre = $(".stdout-pane pre")
    .append(output);
  pre.scrollTop(pre.prop("scrollHeight"));
});

socket.on("ran", function(stdout, stderr) {
  var textEl = $("<div />");
  textEl.text(stdout.join(""));

  var errEl = $("<div class='stderr'/>");
  errEl.text(stderr.join(""));

  var pre = $(".stdout-pane pre");
  var top = pre.prop("scrollHeight");

  pre
    .append(textEl)
    .append(errEl)
    .append("<hr />")
    .scrollTop(top - 32);
});

socket.on("set_language", function(lang) {
  setLang(lang);
});


var splitobj = Split(["#editorbox","#outputbox"], {
  cursor: "col-resize",
  gutterSize: 6,
});


// event handlers
$(".language").on("change", function(e) {
  setLang(e.target.value);
  socket.emit("set_language", e.target.value);
});

$(".stdin.heading").click(function() {
  var $editor = $("#editor textarea");
  var $stdinEl = $(".stdin-pane");
  $stdinEl.slideToggle(function() {
    if ($stdinEl.is(":visible")) {
      $stdinEl.find("textarea").focus();
    } else {
      $editor.focus();

    }
  });
});

$(".run").click(function() {
  var stdin = $(".stdin-pane textarea").val();
  socket.emit("run", docId, stdin);
});
