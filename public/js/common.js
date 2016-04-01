// Init the API key for mapbox.
this.access_token = 'pk.eyJ1Ijoic3NhcmFuZ2kxMjMiLCJhIjoiY2ltOWpmeno4MDNwNHRubTZobW50Y2ljZiJ9.yidy_pQjADEQ8vD7j_m1hw'
L.mapbox.accessToken = this.access_token;

// Globals for the Mapbox server
var map = L.mapbox.map('map', 'peterqliu.39d14f8b',{'scrollWheelZoom':true})
              .setView([37.8, -96], 14);
              
var maputils = new MapUtils(map, this.access_token);
var socket = io();


function thief_game_loop() {
    var moveStep;

    function thief_directions_updated() {
        maputils.draw_path(this.thief.linestring);
        this.thief.add_icon(maputils);
        
        // Move the map the where the thief is.
        maputils.panTo(this.thief.startpoint.lat, this.thief.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_frame();
    }

    // Initialize the Actor. In this case, a new thief first
    this.thief = new Actor(THIEF, 0);
    this.thief.initialize(new Pos(37.796931, -122.265491), new Pos(37.78, -122.42));
    this.thief.get_directions(maputils, thief_directions_updated);
    
    function update_frame() {
        this.thief.update_marker();
        maputils.panTo(this.thief.currentpos.lat, this.thief.currentpos.lng);
        socket.emit("thief_loc", {"lat": this.thief.currentpos.lat, "lng": this.thief.currentpos.lng });
        if (!this.thief.at_end_pt()) { moveStep = setTimeout(update_frame, 100); }
    }
    
    var thief = this.thief;
    
    map.on('click', function(e) {
        window.clearTimeout(moveStep);
        thief.endpoint = new Pos(e['latlng']['lat'], e['latlng']['lng']);
        thief.reset();
        maputils.clearPath();
        thief.get_directions(maputils, thief_directions_updated);
    });
}

function cop_game_loop() {
    var username = "myname";
    var my_id = null;
    var me = null;
    var thief = null;
    
    // Emit a new request
    socket.emit("new_cop_request", username);
    
    socket.on('cop_id', function(id) {
       my_id = id;
       initialize_cop();
    });
    
    socket.on('no_room', function(msg) {
        alert("No more room on Server. Try again later!!!");
    });
    
    socket.on('thief_loc', function(loc) {
         if (thief == null) {
             thief = new Actor(THIEF, 0);
             thief.startpoint = new Pos(loc["lat"], loc["lng"]);
             thief.add_icon(maputils);
        }

         var pos = new Pos(loc[0], loc[1]);
         thief.update_networked_marker(loc);
         maputils.panTo(loc.lat, loc.lng);
    });
    
    function initialize_cop() {
        me = new Actor(COP, my_id);
        me.initialize(new Pos(37.796931, -122.265491), new Pos(37.78, -122.42));
        // me.get_directions(maputils, )
    }
}