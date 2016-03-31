var express = require('express');
var app  = express();
var http = require('http').Server(app);
var io   = require('socket.io')(http); 

var port = process.env.PORT || 8080;
var ip = process.env.IP || "127.0.0.1";

app.use(express.static('public'));

app.get('/', function(req, res) {
    res.sendFile(__dirname + "/html/index.html");
});

var userData = function(name) {
    this.name = name;
    this.id = null;
    this.lng = null;
    this.lat = null;
}

var users_id_map = {}

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
    
    socket.on('user_location', function(user_data) {
        users_id_map[this.id].lng = user_data["lng"];
        users_id_map[this.id].lat = user_data["lat"];
        users_id_map[this.id].id = user_data["id"];
        
        socket.broadcast.emit('user_location', user_data); 
    });
})

http.listen(port, ip, function() {
    console.log("listening on " + ip + ":" + port);
});