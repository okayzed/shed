if (typeof ot === 'undefined') {
  var ot = {};
}

ot.ReplayClient = (function (global) {
  'use strict';

  // Constructor. Takes the current document as a string and optionally the array
  // of all operations.
  function ReplayClient (document, operations) {
    this.document = document;
    this.documents = [document];
    this.index = 0;
    this.operations = operations || [];
    this.cm = null;
  }

  ReplayClient.prototype.redraw = _.throttle(function() {
    var scrollInfo = this.cm.getScrollInfo();
    this.cm.setValue(this.document);
    this.cm.scrollTo(scrollInfo.left, scrollInfo.top);
  }, 100, { leading: true, trailing: true });

  // Call this method whenever you receive an operation from a client.
  ReplayClient.prototype.receiveOperation = function (revision, operation) {
    if (revision < 0 || this.operations.length < revision) {
      throw new Error("operation revision not in history");
    }
    // Find all operations that the client didn't know of when it sent the
    // operation ...
    var concurrentOperations = this.operations.slice(revision);

    // ... and transform the operation against all these operations ...
    var transform = operation.constructor.transform;
    for (var i = 0; i < concurrentOperations.length; i++) {
      operation = transform(operation, concurrentOperations[i])[0];
    }

    // ... and apply that on the document.
    this.document = operation.apply(this.document);
    this.documents.push(this.document);
    this.index++;
    // Store operation in history.
    this.operations.push(operation);

    // It's the caller's responsibility to send the operation to all connected
    // clients and an acknowledgement to the creator.
    return operation;
  };

  // Call this method whenever you receive an operation from a client.
  ReplayClient.prototype.undo = function () {
    this.index--;
    this.document = this.documents[this.index];
    this.redraw();
  };

  ReplayClient.prototype.redo = function() {
    this.index++;
    this.document = this.documents[this.index];
    this.redraw();
  }

  return ReplayClient;

}(this));

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
      PLAY_CLIENT.undo();
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
      PLAY_CLIENT.redo();
      PLAY_FRAME++;

    }

    while (spot < PLAY_FRAME) {
      PLAY_CLIENT.undo();
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

  var server = new ot.ReplayClient("", []);

  var scrubber = $(".replaycontrols .scrubber input");
  scrubber.attr("max", PLAY_FRAMES.length);
  scrubber.attr("min", 1);
  PLAY_CLIENT = server;
  PLAY_CLIENT.cm = cm;

  var cStart = new Date(PLAY_FRAMES[0].created_at);
  for (var i = 0; i < PLAY_FRAMES.length; i++) {
    var op = PLAY_FRAMES[i];
    if (!op) {
      continue;
    }
    if (op.change.type == "op") {
      var wrappedOp = ot.TextOperation.fromJSON(op.change.wrapped);
      server.receiveOperation(i, wrappedOp);
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
  cm.setValue(server.document);
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
          PLAY_CLIENT.undo();

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

      PLAY_CLIENT.redo();

      updateTimer()

      PLAY_FRAME += PLAY_DIRECTION;
    }, 50);
}


