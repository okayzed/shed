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

function setIndent(amt) {
  cm.setOption("indentUnit", amt);
}

function setKeymap(mode) {
  cm.setOption("keyMap", mode);
}

function runCode() {
  socket.emit("run", docId);
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

  var DEFAULT_SETTINGS = {
    colorscheme: "default",
    keymap: "default",
    indent: "4"
  };
  function makeSettingRow(options) {
    var settingsStr = localStorage.settings;
    var saved = DEFAULT_SETTINGS;
    if (settingsStr) {
      try {
        saved = JSON.parse(localStorage.settings);
      } catch(e) { }
    }

    var labelEl = $("<span class='label' />");
    labelEl.text(options.text);

    var btnGroupEl = $("<div class='btn-group btn-group-toggle controls' />");
    btnGroupEl.attr("value", options.name);
    btnGroupEl.addClass(options.name);
    btnGroupEl.attr("data-toggle", "buttons");

    for (var id in options.options) {
      var opt = options.options[id];
      var btnLabel = $("<label class='btn btn-secondary' />");
      var inputEl = $("<input type='radio' />");
      inputEl.attr("name", options.name);
      inputEl.attr("id", id);
      inputEl.attr("value", opt);

      if (opt == saved[options.name]) {
        btnLabel.addClass("active");
        inputEl.prop("checked", true);
      }
      btnLabel.append(inputEl);
      btnLabel.append(id);

      btnGroupEl.append(btnLabel);
    };

    var outerEl = $("<div class='clearfix' />");
    outerEl.append(labelEl);
    outerEl.append(btnGroupEl);
    return outerEl;
  }

  var prevSettings = {};
  function setSettings(options) {
    var anyChange = false;
    if (options.keymap != prevSettings.keymap) {
      setKeymap(options.keymap.replace("kb_", ""));
      anyChange = true;
    }

    if (options.colorscheme != prevSettings.colorscheme) {
      setTheme(options.colorscheme);
      anyChange = true;
    }

    if (options.indent != prevSettings.indent) {
      setIndent(options.indent);
      anyChange = true;
    }

    if (anyChange) {
      localStorage.settings = JSON.stringify(options);
    }

    prevSettings = options;
  }

  function checkSettings() {
    var settingsEl = $("#settingsModal");

    var opts = {};
    var controlRows = settingsEl.find(".controls");

    controlRows.each(function() {
      var name = $(this).attr("value");
      opts[name] = $(this).find(":checked").attr("value")
    });

    setSettings(opts);
  }

  function buildSettingsModal() {
    var settings = [
      {
        name: "colorscheme",
        text: "Colorscheme",
        options: {
          light: "default",
          dark: "monokai"
        }
      },
      {
        name: "keymap",
        text: "Keybindings",
        options: {
          default: "default",
          vim: "vim",
          emacs: "emacs"
        }
      },
      {
        name: "indent",
        text: "Indenting",
        options: {
          "2px": "2",
          "4px": "4",
          "8px": "8"
        }
      }
    ];

    var settingsModal = $("#settingsModal");
    var modalBody = settingsModal.find(".modal-body");
    for (var rowId in settings) {
      var rowEl = makeSettingRow(settings[rowId]);
      modalBody.append(rowEl);
      modalBody.append("<div class='separator' />");
    };

    var saved = JSON.parse(localStorage.settings || "{}");
    setSettings(saved);
  }


  $(function() {
    cm = CodeMirror.fromTextArea(document.getElementById("note"), {lineNumbers: true});
    buildSettingsModal();

    var settingsInterval;
    $("#settingsModal").on("shown.bs.modal", function() {
      clearInterval(settingsInterval);
      settingsInterval = setInterval(checkSettings, 500);
    });

    $("#settingsModal").on("hidden.bs.modal", function() {
      clearInterval(settingsInterval);
      checkSettings();
    });

  });
}
