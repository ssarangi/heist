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

var userData = function(name) {
    this.name = name;
    this.id = null;
    this.lng = null;
    this.lat = null;
}


var MAX_COPS = 5;
var users_id_map = {}
var current_cop = 0;
var cops = {}

var thief_loc = null;

io.on('connection', function(socket) {
    console.log('a user connected');
    
    socket.on('disconnect', function() {
        var username = users_id_map[this.id];
        delete users_id_map[this.id];
        socket.broadcast.emit('user_disconnected', username);
        console.log(username + ' disconnected');
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
        socket.broadcast.emit('thief_loc', user_data); 
    });
    
    socket.on('new_cop_request', function(username) {
        if (Object.keys(cops).length > MAX_COPS) {
            socket.emit("no_room", "");
        } else {
            socket.emit("cop_id", {"id": current_cop, "thief_pos": thief_loc});
            current_cop += 1;
        }
    });
})

http.listen(port, ip, function() {
    console.log("listening on " + ip + ":" + port);
});