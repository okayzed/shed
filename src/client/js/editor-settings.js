function setLang(mode) {
  var langEl = $(".language");
  if (mode != langEl.val()) {
    langEl.val(mode);
  }

  if (mode == "okp") {
    mode = "python";
  }

  if (mode == "python2" || mode == "python3") {
    mode = "python"
  }


  var md = CodeMirror.findModeByName(mode);
  if (md) {
    cm.setOption("mode", md.mime);
    CodeMirror.autoLoadMode(cm, md.mode);
  } else {
    console.log("CAN NOT FIND MODE", mode);
  }
}

function setTheme(mode) {
  cm.setOption("theme", mode);
  if (mode == "monokai") {
    $("body").addClass("dark");
    $("body").removeClass("light");
  } else {
    $("body").addClass("light");
    $("body").removeClass("dark");
  }
}

function setName(name) {
  socket.emit("set_name", name);
}

function setIndent(amt) {
  try { amt = parseInt(amt, 10); }
  catch(e) { amt = 4; }

  cm.setOption("indentUnit", amt);
}

function setAutoCloseBrackets(f) {
  cm.setOption("autoCloseBrackets", !!f);
}

function setKeymap(mode) {
  cm.setOption("keyMap", mode);
}

function setAutoComplete(f) {
  cm.setOption("autoComplete", !!f);
}

function showWordCount(v) {
  if (v) {
    $(".wordcount").show();
  } else {
    $(".wordcount").hide();
  }
}

var CLIENT_NAME;
function clientName(v) {
  CLIENT_NAME = v;
  socket.emit("set_name", v);
}

var DEFAULT_SETTINGS = {
  colorscheme: "default",
  keymap: "default",
  indent: "2",
  autoCloseBrackets: true,
  autoComplete: true,
  showWordCount: false
};
function makeSettingsRow(options) {
  var settingsStr = localStorage.settings;
  var saved = DEFAULT_SETTINGS;
  if (settingsStr) {
    try {
      saved = JSON.parse(localStorage.settings);
    } catch(e) { }
  }

  var labelEl = $("<span class='label' />");
  labelEl.text(options.text);

  var outerEl = $("<div class='clearfix' />");
  outerEl.append(labelEl);
  if (options.options) {
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
    outerEl.append(btnGroupEl);
  }

  if (options.input) {
    var inputEl = $("<input type='text' class='input' />");
    inputEl.attr("name", options.name);
    console.log("SAVED", saved[options.name]);
    inputEl.val(saved[options.name]);
    outerEl.append(inputEl);
  }

  return outerEl;
}

var prevSettings = {};
function setSettings(options) {
  var anyChange = false;
  if (options.keymap != prevSettings.keymap) {
    setKeymap(options.keymap || "default");
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

  if (options.autoCloseBrackets != prevSettings.autoCloseBrackets) {
    setAutoCloseBrackets(options.autoCloseBrackets);
    anyChange = true;
  }

  if (options.autoComplete != prevSettings.autoComplete) {
    setAutoComplete(options.autoComplete);
    anyChange = true;
  }

  if (options.showWordCount != prevSettings.showWordCount) {
    showWordCount(options.showWordCount);
    anyChange = true;
  }

  if (options.clientName != prevSettings.clientName) {
    clientName(options.clientName);
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

  var inputRows = settingsEl.find(".input");
  inputRows.each(function() {
    var name = $(this).attr("name");
    opts[name] = $(this).val();
  });

  setSettings(opts);
}

function buildSettingsModal() {
  var settings = [
    {
      name: "clientName",
      text: "Username",
      input: true
    },
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
    },
    {
      name: "autoCloseBrackets",
      text: "Auto Close Brackets",
      options: {
        "Enabled": "true",
        // we use empty string as falsey bc it can store on the DOM properly
        "Disabled": ""
      }
    },
    {
      name: "autoComplete",
      text: "Auto Complete Words",
      options: {
        "Enabled": "true",
        // we use empty string as falsey bc it can store on the DOM properly
        "Disabled": ""
      }
    },
    {
      name: "showWordCount",
      text: "Show word and character count",
      options: {
        "Enabled": "true",
        "Disabled" : ""
      }
    },
  ];

  var settingsModal = $("#settingsModal");
  var modalBody = settingsModal.find(".modal-body");
  for (var rowId in settings) {
    var rowEl = makeSettingsRow(settings[rowId]);
    modalBody.append(rowEl);
    modalBody.append("<div class='separator' />");
  };

  var saved = JSON.parse(localStorage.settings || "{}");
  try {
    setSettings(saved);
  } catch(e) {};

  var settingsInterval;
  $("#settingsModal").on("shown.bs.modal", function() {
    clearInterval(settingsInterval);
    settingsInterval = setInterval(checkSettings, 500);
  });

  $("#settingsModal").on("hidden.bs.modal", function() {
    clearInterval(settingsInterval);
    checkSettings();
  });

}

