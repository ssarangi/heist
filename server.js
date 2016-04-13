var express = require('express');
var app  = express();
var http = require('http').Server(app);
var io   = require('socket.io')(http); 

var port = process.env.PORT || 8080;
var ip = process.env.IP || "127.0.0.1";
var cop_joined_order = {};

app.use(express.static('public'));

app.get('/thief', function(req, res) {
    res.sendFile(__dirname + "/html/thief.html");
});

app.get('/', function(req, res) {
    res.sendFile(__dirname + "/html/cop.html");
});

app.get('/nt', function(req, res) {
    res.sendFile(__dirname + "/html/newthief.html");
});

var userData = function(name) {
    this.name = name;
    this.id = null;
    this.lng = null;
    this.lat = null;
}


var MAX_COPS = 3;
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
        if (cops[this.id] != undefined) {
            cops_id_queue.enqueue(cops[this.id]);
            socket.broadcast.emit('cop_left', cops[this.id]);
            delete cops[this.id];
        }
        
        delete users_id_map[this.id];
    });
    
    socket.on('user_connected', function(username) {
        var ud = new userData(username);
        users_id_map[this.id] = ud;

        if (Object.keys(users_id_map).length == MAX_COPS + 1) {
            io.to(this.id).emit("start_game", {"type": "thief", "num_cops" : MAX_COPS});
        } else {
            cops[this.id] = null;
        }
        
        // var users = [];
        // for (var key in users_id_map) {
        //   if (users_id_map.hasOwnProperty(key)) {
        //     users.push(users_id_map[key]);
        //   }
        // }
        
        // if (users.length > 0) {
        //     io.to(this.id).emit('current_users', users);
        // }
    });
    
    socket.on('cops_start_pos', function(pos) {
        var i = 0;
        for (var key in cops) {
            if (cops_id_queue.size() == 0) {
                socket.emit("no_room", "");
            } else {
                var id = cops_id_queue.dequeue();
                console.log("served id " + id);
                cops[key] = id;
                io.to(key).emit("start_game", {"id": id, "pos": pos.cops_start_pos[i], "thief_loc": pos.thief_loc, "goal_pt": pos.goal_pt});
            }
            
            i += 1;
        }
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
    
    socket.on('thief_won', function(txt) {
       cop_joined_order = {};
       socket.broadcast.emit('thief_won'); 
    });
    
    socket.on('cop_won', function(txt) {
       cop_joined_order = {};
       socket.broadcast.emit('cop_won',txt); 
    });
    
    socket.on('cop_joined', function(txt) {
        console.log("Cop " + txt + " joined");
        socket.broadcast.emit('cop_joined', txt);
        //send to new cop list of previous cops who joined
        socket.emit('previous_cops', cop_joined_order);
        cop_joined_order[txt] = txt;
    });
})

http.listen(port, ip, function() {
    console.log("listening on " + ip + ":" + port);
});