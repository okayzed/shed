var socket;
var docId;
var cm;

var _unseen_count = 0;

function runCode() {
  socket.emit("run", docId);
}


function initShed(id, replayMode) {
  socket = io();
  docId = id;

  var mac = CodeMirror.keyMap["default"] == CodeMirror.keyMap.macDefault;

  var extraKeys = {
    "Ctrl-C": function (cm) {
        if (!mac && cm.getOption('keyMap').substr(0, 3) === 'vim') document.execCommand("copy");
        else return CodeMirror.Pass;
    }
  };

  cm = CodeMirror.fromTextArea(document.getElementById("note"), {
    lineNumbers: true,
    matchBrackets: true,
    extraKeys: extraKeys,
    hintOptions: {
      completeSingle: false
    }
  });
  cm.on("inputRead", function(instance) {
      if (!cm.options.autoComplete) {
        return;
      }
      if (instance.state.completionActive) {
              return;
      }
      var cur = instance.getCursor();
      var token = instance.getTokenAt(cur);
      if (token.type && token.type != "comment") {
              CodeMirror.commands.autocomplete(instance);
      }
  });


  // socket stuff
  var _dc = false;
  socket.on("disconnect", function() {
    console.log("SOCKET DISCONNECTED");
    _dc = true;
  });

  socket.on('connect', function() {
    console.log("SOCKET CONNECTED");
    if (!replayMode) {
      socket.emit("join", docId);
    } else {
      installReplayControls();

      socket.emit("replay", docId);
      socket.emit("get_language", docId);
      socket.on("replay", function(ch, lang) {
        $(".play.btn").text("Play");
        PLAY_FRAMES = ch.concat(null);
        cm.options.readOnly = true;
        replayChanges();
        fastPlayBack();
      });
    }
  });

  var serverAdapter, editorAdapter, client;
  socket.on("doc", function(data) {
    if (!replayMode) {
      if (editorAdapter) {
        editorAdapter.callbacks = {};
        editorAdapter.detach();
      }

      if (serverAdapter) {
        serverAdapter.callbacks = {};
      }

      var cursor = cm.getCursor();
      cm.setValue(data.str)
      cm.setCursor(cursor);
      cm.setOption("lineWrapping", true);

      serverAdapter = new ot.SocketIOAdapter(socket);
      editorAdapter = new ot.CodeMirrorAdapter(cm);
      client = new ot.EditorClient(data.revision, data.clients, serverAdapter, editorAdapter)
    }
  });

  socket.on("output", function(output) {
    var pre = $(".stdout-pane pre")
      .append(output);
    pre.scrollTop(pre.prop("scrollHeight"));
    update_toggle_count(1);
  });

  socket.on("stdin", function(stdin) {
    var stdinEl = $(".stdin-pane textarea");
    stdinEl.val(stdin);
  });

  function countNewlines(t) {
    l = 0;
    for (var c in t) { if (t[c] == "\n") { l++; } }
    return l;
  }

  socket.on("ran", function(stdout, stderr) {
    var textEl = $("<div class='card' />");
    var txt = stdout.join("").trim();

    textEl.text(txt);
    update_toggle_count(1);
    if (txt.length > 500 || countNewlines(txt) > 30) {
      var prp = $("<a class='expander' href='#'>Expand</a>");
      var tgl = false;
      prp.on("click", function(e) {
        tgl = !tgl;
        e.preventDefault();

        if (tgl) {
          textEl.removeClass("collapsed");
          prp.text("Collapse");
        } else {
          textEl.addClass("collapsed");
          prp.text("Expand");
        }
      });
      textEl.addClass("collapsed");
      textEl.prepend(prp);
    }


    var errEl = $("<div class='stderr'/>");
    errEl.text(stderr.join("").trim());

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


  var splitobj;
  function makeSplit() {
    try { if (splitobj) { splitobj.destroy(); } } catch(e) {};
    var sizes = [50, 50];
    if (window.localStorage) {
      sizes = localStorage.getItem('split-sizes') || [50, 50];
      if(typeof sizes === 'string') sizes= sizes.split(",").map(Number);
    }

    $(".split-pane").css("float", "left");

    splitobj = Split(["#editorbox","#outputbox"], {
      cursor: "col-resize",
      gutterSize: 6,
      sizes: sizes,
      onDragEnd: function () {
          window.localStorage && localStorage.setItem('split-sizes', splitobj.getSizes());
      },
      minSize: 0
    });
  }

  var resize = _.debounce(function() {
    if (window.innerWidth < 768 ) {
      try { splitobj && splitobj.destroy(); } catch(e) {};
      sync_editor();
    } else {
      // turn into horizontal mode.
      // show button for toggling editor/output
      makeSplit();
      $("#outputbox, #editorbox").show();
      $(".output-toggle").hide();
    }
  }, 200);
  $(window).on("resize", resize);

  $(resize);


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

  $(".run-replay").click(function() {
    var stdin = $(".stdin-pane textarea").val();
    var code = cm.getValue();
    var lang = $(".language").val();
    socket.emit("runReplay", code, lang, stdin);
  });

  var showingEditor = true;
  function show_output() {
    $("#outputbox").show();
    $("#editorbox").hide();

    $(".output-toggle").text("Editor");
    reset_toggle_count();
  }

  function show_editor() {
    $("#editorbox").show();
    $("#outputbox").hide();
    $(".output-toggle").text("Output");
  }

  function update_toggle_count(count) {
    _unseen_count += count;
    if (showingEditor && _unseen_count) {
      $(".output-toggle").text("Output (" + _unseen_count + ")");
    }
  }

  function reset_toggle_count() {
    _unseen_count = 0;
    if (showingEditor) {
      $(".output-toggle").text("Output");
    }

  }

  function sync_editor() {
    $(".output-toggle").show();

    if (showingEditor) {
      show_editor();
    } else {
      show_output();
    }
  }

  $(".output-toggle").on("click", function() {
    showingEditor = !showingEditor;
    sync_editor();
  });

  $(function() {
    buildSettingsModal();
  });
}
