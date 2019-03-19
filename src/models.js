
var Sequelize = require("sequelize");

var sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: 'db.sqlite',
  logging: function() { },
  define: {
    sync: { force: true },
    underscored: true
  }
});


var Post = sequelize.define('Post', {
  text: Sequelize.TEXT,
  randid: Sequelize.STRING,
  filetype: Sequelize.STRING,
  stdin: Sequelize.TEXT
}, {
  indexes: [ {
    fields: ['randid']
  }]
});

var replaydb = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: 'replays.sqlite',
  logging: function() { },
  define: {
    sync: { force: true },
    underscored: true
  }
});

var PostOp = replaydb.define('PostOp', {
  randid: Sequelize.STRING,
  change: Sequelize.JSON
}, {
  indexes: [ {
    fields: ['randid']
  }]

});

var PostOpBlob = replaydb.define('PostOpBlob', {
  randid: { type: Sequelize.STRING, unique: true },
  changes: Sequelize.BLOB,
  indexes: [ {
    fields: ['randid']
  }],
});

var force_reset = process.env.RESET;
sequelize.sync({ force: force_reset }).then(function() {
  console.log("Synced SQL DB to models");

});
replaydb.sync({ force: force_reset }).then(function() {
  console.log("Synced SQL ReplayDB to models");
});


var zlib = require("zlib");
function getPostOps(randid, cb) {
  PostOp.findAll({where: { randid: randid}, raw: true}).then(function(changes) {
    PostOpBlob.findOrCreate({where: {randid: randid}}).then(function(blobs) {
      var blob = blobs[0];

      var blobChanges = [];
      if (blob.changes) {
        blobChanges = JSON.parse(zlib.gunzipSync(blob.changes));
      }

      var dirty = false;
      var del = [];
      for (var c in changes) {
        var change = changes[c];
        blobChanges.push(change);
        change.change = JSON.parse(change.change);
        del.push(change.id);
        dirty = true;
      }

      for (var c in blobChanges) {
        var change = blobChanges[c];
        if (change.updated_at) {
          delete change.updated_at;
          dirty = true;
        }

        if (change.randid) {
          delete change.randid;
          dirty = true;
        }
      }

      if (dirty) {
        blob.changes = zlib.gzipSync(JSON.stringify(blobChanges));
        blob.save().then(function() {
          console.log("SAVED BLOB", randid)
          if (del.length > 0) {
            PostOp.destroy({where: { id: del }}).then(function() {
              cb(blobChanges);
            });
          }
        });
      } else {
        cb(blobChanges);
      }

    });
  });
}

function packPostOps() {
  function packAndMoveOn(rows) {
    var i = 0;
    function next() {
      if (i >= rows.length) { return; }

      var row = rows[i];
      var randid = row.DISTINCT;
      i++;
      getPostOps(randid, function() {
        setTimeout(next, 100);
      });
    }

    next();
  }

  PostOp.aggregate('randid', 'DISTINCT', { plain: false })
    .then(function(rows) {
      packAndMoveOn(rows);
    });
}

setInterval(packPostOps, 5 * 60 * 1000); // every 5 minutes we pack

// all models defined need to be required somewhere before the main setup is called
module.exports.instance = sequelize;
module.exports.Post = Post;
module.exports.PostOp = PostOp;
module.exports.getPostOps = getPostOps;
