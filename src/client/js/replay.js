
function updateTimer() {
  var cStart = new Date(PLAY_FRAMES[0].created_at);

  var op = PLAY_FRAMES[Math.min(PLAY_FRAME, PLAY_FRAMES.length-2)];
  var cNow = new Date(op.created_at);
  var t = cNow - cStart;

  t /= 1000;

  var h = parseInt(t / 3600);
  var m = parseInt(t / 60 % 60);
  var s = parseInt(t % 60);

  if (h < 10) { h = '0' + h; }
  if (m < 10) { m = '0' + m; }
  if (s < 10) { s = '0' + s; }

  // console.log("H", h, "M", m, "S", s);
  $(".replaycontrols .time").text(h + ":" + m + ":" + s);

  $(".replaycontrols .scrubber input").val(PLAY_FRAME);

}

var PLAY_FRAME = 0;
var PLAY_DIRECTION = 1;
var PLAY_STATE = 0;
var CALLS_PER_FRAME = 5;

function setPlayButton() {
  if (PLAY_STATE == 'pause') {
    $(".replaycontrols .play").text("Play");
  } else {
    $(".replaycontrols .play").text("Pause");
  }
}

function installReplayControls() {
  function reset() {
    while (PLAY_FRAME > 0) {
      CodeMirror.prototype.undo.call(cm);
      PLAY_FRAME--;
    }
    PLAY_FRAME = 0;
    PLAY_STATE = 'play';
    setPlayButton();
    fastPlayBack();
  }

  $(".replaycontrols .reset").on("click", function() {
    reset();
  });

  $(".replaycontrols .play").on("click", function() {
    if (PLAY_STATE == 'pause') {
      PLAY_STATE = 'play';
      if (PLAY_FRAME == PLAY_FRAMES.length) {
        reset();
      }
    } else {
      PLAY_STATE = 'pause';
    }

    setPlayButton();
  });

  $(".replaycontrols .rewind").on("click", function() {
    PLAY_STATE = 'rewind'
    setPlayButton();
  });

  $(".replaycontrols .scrubber input").on("input", function(e) {
    var spot = $(e.target).val();
    PLAY_STATE = 'pause'
    setPlayButton();

    while (spot > PLAY_FRAME) {
      CodeMirror.prototype.redo.call(cm);
      PLAY_FRAME++;

    }

    while (spot < PLAY_FRAME) {
      CodeMirror.prototype.undo.call(cm);
      PLAY_FRAME--;
    }

    updateTimer();
  });



}

var PLAY_HANDLE;
function cancelPlayBack() {
  if (PLAY_HANDLE) {
    clearInterval(PLAY_HANDLE);
  }
}

var PLAY_CLIENT;
function replayChanges() {
  if (!PLAY_FRAMES.length) {
    return;
  }

  var scrubber = $(".replaycontrols .scrubber input");
  scrubber.attr("max", PLAY_FRAMES.length);
  scrubber.attr("min", 1);
  var adapter = new ot.SocketIOAdapter(socket);
  var editor = new ot.CodeMirrorAdapter(cm);
  var client = new ot.EditorClient(0, [], adapter, editor)
  cm.undoDepth = PLAY_FRAMES.length;
  PLAY_CLIENT = client;

  var cStart = new Date(PLAY_FRAMES[0].created_at);
  for (var i = 0; i < PLAY_FRAMES.length; i++) {
    var op = PLAY_FRAMES[i];
    if (!op) {
      continue;
    }
    if (op.change.type == "op") {
      adapter.trigger("operation", op.change.wrapped, op.change.meta);
      updateTimer()
    } else if (op.change.type == "sel") {
//      SELECTION NOT USED
//      adapter.trigger("selection", op.change.clientId, op.change.selection);
//      updateTimer(cDelta)
    }
  }
  PLAY_FRAME = PLAY_FRAMES.length;
  scrubber.val(PLAY_FRAMES.length);
  updateTimer();
}

function fastPlayBack(cli) {
    var cStart = new Date(PLAY_FRAMES[0].created_at);
    var client = PLAY_CLIENT;


    var current_call = 0;
    cancelPlayBack();
    PLAY_HANDLE = setInterval(function() {
      current_call++;
      if (current_call % CALLS_PER_FRAME != 0) {
        return;
      }

      if (PLAY_STATE == 'rewind') {
        if (PLAY_FRAME > 0) {
          CodeMirror.prototype.undo.call(cm);

          PLAY_FRAME--;
          if (PLAY_FRAME < PLAY_FRAMES.length && PLAY_FRAME >= 0) {
            updateTimer()
          }
        }
        return;
      }

      if (PLAY_STATE == 'pause') {
        return;
      }


      if (PLAY_FRAME >= PLAY_FRAMES.length) {
        PLAY_STATE = 'pause'
        setPlayButton();
        return;
      }

      CodeMirror.prototype.redo.call(cm);

      updateTimer()

      PLAY_FRAME += PLAY_DIRECTION;
    }, 50);
}


