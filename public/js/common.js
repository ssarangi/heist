// Init the API key for mapbox.
this.access_token = 'pk.eyJ1Ijoic3NhcmFuZ2kxMjMiLCJhIjoiY2ltOWpmeno4MDNwNHRubTZobW50Y2ljZiJ9.yidy_pQjADEQ8vD7j_m1hw'
L.mapbox.accessToken = this.access_token;

// Globals for the Mapbox server
var map = L.mapbox.map('map', 'mapbox.light',{'scrollWheelZoom':true})
              .setView([37.8, -96], 14);

var maputils = new MapUtils(map, this.access_token);
var socket = io();
var cop_markers = {}

socket.on('cop_loc', function(user_data) {
    var id = user_data['id'];
    var lat = user_data['lat'];
    var lng = user_data['lng'];
    
    if (!(id in cop_markers)) {
        cop_markers[id] = new NPCActor(id);
        cop_markers[id].currentpos = new Pos(lat, lng);
        cop_markers[id].add_icon(maputils);
    }
    
    cop_markers[id].update_marker(lat, lng);
});

socket.on('thief_won', function(msg) {
     alert("Thief Won the game");
});

socket.on('cop_won', function(msg) {
    alert("Cop some guy won");
});


socket.on('thief_goal_pt', function(user_data) {
    var pos = new Pos(user_data['lat'], user_data['lng']);
    maputils.add_goal_pt(pos);
});

function get_N_random_numbers(N, endIdx) {
    var unique_indexes = {};
    if (endIdx > N){
        while (Object.keys(unique_indexes).length < N){
            var rand = Math.floor(Math.random() * (endIdx + 1));
            if (!(rand in unique_indexes)){
                unique_indexes[rand] = rand;
            }
        }
    }
    else {
        for (var i = 0; i <= endIdx; i++){
            unique_indexes[i] = i;
        }
    }
    return unique_indexes;
}

function generate_position_within_radius(pos, radius) {
   var center_feature = {
        'type' : 'Features',
        "properties": {},
        'geometry' : {
            'type' : 'Point',
            'coordinates' : [pos.lng, pos.lat]
        },
        'properties' : {
            'name' : 'Thief Loc'
        }
    };
    
    var one_mile_out = turf.buffer(center_feature, radius, 'miles');
    var features = one_mile_out['features']
    var geometry = features[0]['geometry']
    var list_of_points = geometry['coordinates'][0]
    var random_indexes = get_N_random_numbers(1, list_of_points.length);
    
    for (var key in random_indexes) {
        var coords = list_of_points[random_indexes[key]];
        var point = new Pos(coords[1], coords[0]);
        return point;
    }
}

function thief_game_loop() {
    var moveStep;
    var start_pt = new Pos(37.796931, -122.265491);
    var game_over = false;

    function thief_directions_updated() {
        maputils.draw_path(this.thief.linestring);
        this.thief.add_icon(maputils);
        
        // Move the map to where the thief is.
        maputils.panTo(this.thief.startpoint.lat, this.thief.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_frame();
    }

    var goal_pt = generate_position_within_radius(start_pt, 5);
    maputils.get_directions([start_pt.lng, start_pt.lat], [goal_pt.lng, goal_pt.lat], function(data) {
        var len = data.routes[0].geometry.coordinates.length;
        var coords = data.routes[0].geometry.coordinates[len - 1];
        goal_pt = new Pos(coords[1], coords[0]);
        socket.emit("thief_goal_pt", {"lat": goal_pt.lat, "lng": goal_pt.lng });
        maputils.add_goal_pt(goal_pt);
    });
    
    // socket.on('cop_won', function(msg) {
    //     game_over = true;
    //     alert(msg);
    // });
    
    // Initialize the Actor. In this case, a new thief first
    this.thief = new Actor(THIEF, 0);
    this.thief.initialize(start_pt, goal_pt);
    this.thief.get_directions(maputils, thief_directions_updated);
    
    function update_frame() {
        if(!game_over){
            this.thief.update_marker();
            maputils.panTo(this.thief.currentpos.lat, this.thief.currentpos.lng);
            socket.emit("thief_loc", {"lat": this.thief.currentpos.lat, "lng": this.thief.currentpos.lng });
            if (!this.thief.at_end_pt(maputils)) { 
                moveStep = setTimeout(update_frame, 100);
            } else {
                var distance = maputils.distance(this.thief.currentpos, goal_pt);
                if (distance < 0.05) {
                    socket.emit("thief_won", "");
                    alert("Thief Won");
                } else {
                    this.thief.currentpos = this.thief.startpoint;
                    this.thief.reset();
                    moveStep = setTimeout(update_frame, 100);
                }
            }
        }
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
    var moveStep;
    var user_clicked = false;
    var game_over = false;

    // Emit a new request
    if (my_id == null)
        socket.emit("new_cop_request", username);
    
    socket.on('cop_id', function(info) {
        my_id = info["id"];
        var thief_loc = info.thief_loc;
        var goal_pt = info.goal_pt;
       
        if (thief_loc != null) {
            initialize_cop(thief_loc, goal_pt);
        }
    });
    
    // socket.on('cop_won', function(msg) {
    //     game_over = true;
    //     alert(msg);
    // });
    
    socket.on('no_room', function(msg) {
        alert("No more room on Server. Try again later!!!");
    });
    
    socket.on('thief_loc', function(loc) {
         if (thief == null) {
             thief = new Actor(THIEF, 0);
             thief.startpoint = new Pos(loc["lat"], loc["lng"]);
             thief.add_icon(maputils);
         }
          
         var thief_pos = new Pos(loc["lat"], loc["lng"]);
         if (!game_over){
             if (me != null && me.currentpos != null) {
                 var distance = maputils.distance(thief_pos, me.currentpos);
                 if (distance < 0.01)
                 {
                     var cop_wins = "Cop " + my_id + " wins!";
                     socket.emit("cop_won", cop_wins);
                     game_over = true;
                     alert(cop_wins);
                 }
             }
         }
         
         thief.update_networked_marker(thief_pos);
    });
    
    socket.on('cop_direction_changed', function(user_data) {
        var id = user_data['id'];
        var path = user_data['path'];
        maputils.draw_new_path(id, path);
    });
    
    function my_directions_updated() {
        maputils.draw_new_path(me.id, me.path);
        socket.emit("cop_direction_changed", {"id": me.id, "path": me.path});
        
        me.add_icon(maputils);
        
        // Move the map to where I am moving
        maputils.panTo(me.startpoint.lat, me.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_my_frame();
    }
    
    function update_my_frame() {
        if(!game_over){
            me.update_marker();
            maputils.panTo(me.currentpos.lat, me.currentpos.lng);
            socket.emit("cop_loc", {"id": me.id, "lat": me.currentpos.lat, "lng": me.currentpos.lng });
            if (!me.at_end_pt(maputils)) {
                moveStep = setTimeout(update_my_frame, 100);
            } else if (user_clicked == false) {
                me.endpoint = thief.currentpos;
                me.reset();
                me.get_directions(maputils, my_directions_updated);
            }
        }
    }
    
    function initialize_cop(thief_loc, goal_pt) {
        me = new Actor(COP, my_id);
        var thief_pos = new Pos(thief_loc["lat"], thief_loc["lng"]);
        maputils.panTo(thief_pos.lat, thief_pos.lng);

        var cop_pos = generate_position_within_radius(thief_pos, 0.5);
        me.initialize(cop_pos, thief_pos);
        maputils.add_goal_pt(goal_pt);
        me.get_directions(maputils, my_directions_updated);
    }
    
    map.on('click', function(e) {
        window.clearTimeout(moveStep);
        me.endpoint = new Pos(e['latlng']['lat'], e['latlng']['lng']);
        me.reset();
        // maputils.clearPath();
        me.get_directions(maputils, my_directions_updated);
        this.user_clicked = true;
    });
}