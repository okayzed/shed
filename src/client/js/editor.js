var socket = io()
var docId;
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
  cm.setOption("keyMap", mode);
}

function runCode() {
  socket.emit("run", docId);
}

function setVim() {
  cm.setOption("keyMap", "vim");
}

function setEmacs() {
  cm.setOption("keyMap", "emacs");
}

function initShed(id) {
  docId = id;

  // socket stuff
  var _dc = false;
  socket.on("disconnect", function() {
    console.log("SOCKET DISCONNECTED");
    _dc = true;
  });

  socket.on('connect', function() {
    console.log("SOCKET CONNECTED");
    if (_dc) { window.location.reload(); }
    socket.emit("join", docId);
  });

  socket.on("doc", function(data) {
    cm.setValue(data.str)

    cm.setOption("lineWrapping", true);

    var serverAdapter = new ot.SocketIOAdapter(socket);
    var editorAdapter = new ot.CodeMirrorAdapter(cm);
    var client = new ot.EditorClient(data.revision, data.clients, serverAdapter, editorAdapter)
  });

  socket.on("output", function(output) {
    var pre = $(".stdout-pane pre")
      .append(output);
    pre.scrollTop(pre.prop("scrollHeight"));
  });

  socket.on("stdin", function(stdin) {
    var stdinEl = $(".stdin-pane textarea");
    stdinEl.val(stdin);
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

  $(".stdin-pane textarea").bind('input propertychange', function() {
    socket.emit("stdin", $(".stdin-pane textarea").val());
  });

  $(".run").click(function() {
    var stdin = $(".stdin-pane textarea").val();
    socket.emit("run", docId, stdin);
  });

  var prevSettings = {};
  function setSettings(options) {
    var anyChange = false;
    if (options.keymap != prevSettings.keymap) {
      setKeymap(options.keymap.replace("kb_", ""));
      anyChange = true;
    }

    if (options.colorscheme != prevSettings.colorscheme) {
      var cs = options.colorscheme;
      if (cs == "color_light") {
        setTheme("default");
      } else {
        setTheme("monokai");
      }
      anyChange = true;
    }

    if (anyChange) {
      localStorage.settings = JSON.stringify(options);
    }

    prevSettings = options;
  }

  function checkSettings() {
    var settingsEl = $("#settingsModal");
    var keymapEl = settingsEl.find(".controls.keymap :checked");
    var csEl = settingsEl.find(".controls.colorscheme :checked");

    setSettings({
      keymap: keymapEl.attr("id"),
      colorscheme: csEl.attr("id")
    });

  }

  function loadSettings() {
    var options = JSON.parse(localStorage.settings || "{}");
    var settingsEl = $("#settingsModal");
    var keymap = settingsEl.find("#" + options.keymap);
    $(".controls.keymap input").prop("checked", false);
    keymap.click();

    var cs = settingsEl.find("#" + options.colorscheme);
    $(".controls.colorscheme input").prop("checked", false);
    cs.click();

    setSettings(options);
  }


  $(function() {
    cm = CodeMirror.fromTextArea(document.getElementById("note"), {lineNumbers: true});

    var settingsInterval;
    $("#settingsModal").on("shown.bs.modal", function() {
      clearInterval(settingsInterval);
      settingsInterval = setInterval(checkSettings, 500);
    });

    $("#settingsModal").on("hidden.bs.modal", function() {
      clearInterval(settingsInterval);
      checkSettings();
    });

    loadSettings();
  });
}
