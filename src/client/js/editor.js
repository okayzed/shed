var socket = io()
var docId;
var cm;

function runCode() {
  socket.emit("run", docId);
}

function initShed(id) {
  docId = id;

  cm = CodeMirror.fromTextArea(document.getElementById("note"), {lineNumbers: true});

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
    var textEl = $("<div class='card' />");
    textEl.text(stdout.join("").trim());

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

    $(".split-pane").css("float", "left");

    splitobj = Split(["#editorbox","#outputbox"], {
      cursor: "col-resize",
      gutterSize: 6
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

  var showingEditor = true;
  function show_output() {
    $("#outputbox").show();
    $("#editorbox").hide();
    $(".output-toggle").text("Editor");
  }

  function show_editor() {
    $("#editorbox").show();
    $("#outputbox").hide();
    $(".output-toggle").text("Output");
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
