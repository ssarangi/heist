var express = require('express');
var app  = express();
var http = require('http').Server(app);
var io   = require('socket.io')(http); 

var port = process.env.PORT || 8080;
var ip = process.env.IP || "127.0.0.1";

app.use(express.static('public'));

app.get('/thief', function(req, res) {
    res.sendFile(__dirname + "/html/thief.html");
});

app.get('/cop', function(req, res) {
    res.sendFile(__dirname + "/html/cop.html");
});

app.get('/nt', function(req, res) {
    res.sendFile(__dirname + "/html/newthief.html");
});

app.get('/c', function(req, res) {
    res.sendFile(__dirname + "/html/courier.html");
})

var userData = function(name) {
    this.name = name;
    this.id = null;
    this.lng = null;
    this.lat = null;
}


var MAX_COPS = 6;
var users_id_map = {}
var cops = {}

var thief_loc = null;
var goal_pt = null;

function Queue() {
    this._oldestIndex = 1;
    this._newestIndex = 1;
    this._storage = {};
}
 
Queue.prototype.size = function() {
    return this._newestIndex - this._oldestIndex;
};
 
Queue.prototype.enqueue = function(data) {
    this._storage[this._newestIndex] = data;
    this._newestIndex++;
};
 
Queue.prototype.dequeue = function() {
    var oldestIndex = this._oldestIndex,
        newestIndex = this._newestIndex,
        deletedData;
 
    if (oldestIndex !== newestIndex) {
        deletedData = this._storage[oldestIndex];
        delete this._storage[oldestIndex];
        this._oldestIndex++;
 
        return deletedData;
    }
};

var cops_id_queue = new Queue();
for (var i = 1; i <= MAX_COPS; ++i) {
    cops_id_queue.enqueue(i);
}

io.on('connection', function(socket) {
    console.log('a user connected');
    
    socket.on('disconnect', function() {
        // var username = users_id_map[this.id];
        // delete users_id_map[this.id];
        // socket.broadcast.emit('user_disconnected', username);
        // console.log(username + ' disconnected');
        cops_id_queue.enqueue(cops[this.id]);
    });
    
    socket.on('user_connected', function(username) {
        socket.broadcast.emit('user_connected', username);
        
        var users = [];
        for (var key in users_id_map) {
          if (users_id_map.hasOwnProperty(key)) {
            users.push(users_id_map[key]);
          }
        }
        
        if (users.length > 0) {
            io.to(this.id).emit('current_users', users);
        }

        var ud = new userData(username);
        users_id_map[this.id] = ud;
    });
    
    socket.on('chat_message', function(msg) {
       socket.broadcast.emit('chat message', msg);
    });
    
    socket.on('thief_loc', function(user_data) {
        thief_loc = user_data;
        if (thief_loc != null)
            socket.broadcast.emit('thief_loc', user_data); 
    });
    
    socket.on('cop_loc', function(user_data) {
        socket.broadcast.emit('cop_loc', user_data);
    });
    
    socket.on('thief_goal_pt', function(user_data) {
        goal_pt = user_data;
        socket.broadcast.emit('thief_goal_pt', user_data); 
    });
    
    socket.on('cop_direction_changed', function(user_data) {
        socket.broadcast.emit('cop_direction_changed', user_data); 
    });
    
    socket.on('new_cop_request', function(username) {
        if (cops_id_queue.size() == 0) {
            socket.emit("no_room", "");
        } else {
            var id = cops_id_queue.dequeue();
            cops[this.id] = id;
            socket.emit("cop_id", {"id": id, "thief_loc": thief_loc, "goal_pt": goal_pt});
        }
    });
    
    socket.on('thief_won', function(txt) {
       socket.broadcast.emit('thief_won'); 
    });
})

http.listen(port, ip, function() {
    console.log("listening on " + ip + ":" + port);
});