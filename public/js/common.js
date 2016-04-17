// Init the API key for mapbox.
this.access_token = 'pk.eyJ1Ijoic3NhcmFuZ2kxMjMiLCJhIjoiY2ltOWpmeno4MDNwNHRubTZobW50Y2ljZiJ9.yidy_pQjADEQ8vD7j_m1hw'
L.mapbox.accessToken = this.access_token;

// Globals for the Mapbox server
var map = L.mapbox.map('map', 'mapbox.light',{'scrollWheelZoom':true})
              .setView([37.8, -96], 14);

var maputils = new MapUtils(map, this.access_token);
var socket = io();
var cop_markers = {}
var game_over = false;

socket.emit("user_connected", "");

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
    game_over = true;
    document.getElementById('features').innerHTML += "Thief reached his safehouse. \nGame Over.";
});

socket.on('cop_won', function(cop_id) {
    game_over = true;
    document.getElementById('features').innerHTML += "Cop " + cop_id + " caught up with the thief. \nGame Over.";
});

socket.on('cop_joined', function(cop_id) {
    document.getElementById('features').innerHTML += "Cop " + cop_id + " joined the heist.\n";
});

socket.on('cop_left', function(cop_id){
    document.getElementById('features').innerHTML += "Cop " + cop_id + " left the heist.\n";
    maputils.remove_path(cop_id);
    if (cop_id in cop_markers){
        var cop = cop_markers[cop_id];
        cop.remove_icon(maputils);
        delete cop_markers[cop_id];
    }
});

socket.on('start_game', function(info) {
    if (info.type == "thief") {
        thief_game_loop(info.num_cops);
    } else {
        cop_game_loop(info);
    }
});


socket.on('thief_goal_pt', function(user_data) {
    var pos = new Pos(user_data['lat'], user_data['lng']);
    maputils.add_goal_pt(pos);
});

function get_N_random_numbers(N, endIdx) {
    var unique_indexes = {};
    if (endIdx > N){
        while (Object.keys(unique_indexes).length < N){
            var rand = Math.floor(Math.random() * (endIdx));
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

function generate_position_within_radius(pos, radius, number_of_cops) {
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
    
    console.log("Number of Cops: " + number_of_cops);
    
    var one_mile_out = turf.buffer(center_feature, radius, 'miles');
    var features = one_mile_out['features']
    var geometry = features[0]['geometry']
    var list_of_points = geometry['coordinates'][0]
    var random_indexes = get_N_random_numbers(number_of_cops, list_of_points.length);
    console.log(list_of_points);
    var cop_start_pos = [];
    
    for (var key in random_indexes) {
        console.log(key);
        var coords = list_of_points[random_indexes[key]];
        var point = new Pos(coords[1], coords[0]);
        cop_start_pos.push(point);
    }
    return cop_start_pos;
}


//-------------------------------THIEF LOOP----------------------------------------------
function thief_game_loop(num_cops) {
    var moveStep;
    //SFO
    //var start_pt = new Pos(37.796931, -122.265491);
    //Manhattan
    var start_pt = new Pos(40.763860, -73.981197);
 
    function thief_directions_updated() {
        maputils.draw_path(this.thief.linestring);
        this.thief.add_icon(maputils);
        
        // Move the map to where the thief is.
        maputils.panTo(this.thief.startpoint.lat, this.thief.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_frame();
    }

    var goal_pt = generate_position_within_radius(start_pt, 10, 1)[0];
    
    function get_N_cop_spawn_positions(path, num_cops){
        var linestring = turf.linestring(path);
        var step = 0.75 / (num_cops);
        var curr_step = step;
        var cop_spawn_loc = [];
        for (var i = 0; i < num_cops; i++){
            var point = turf.along(linestring, curr_step, 'miles').geometry.coordinates;
            var cop_start_pt_on_line =  new Pos(point[1], point[0]);
            var cop_spawened_at = generate_position_within_radius(cop_start_pt_on_line, 0.5, 1)[0];
            cop_spawn_loc.push(cop_spawened_at);
            curr_step += step;
        }
        return cop_spawn_loc;
    }
    
    var cop_start_pos = generate_position_within_radius(start_pt, 1, num_cops);
    
   
    
    maputils.get_directions([start_pt.lng, start_pt.lat], [goal_pt.lng, goal_pt.lat], function(data) {
        var len = data.routes[0].geometry.coordinates.length;
        var coords = data.routes[0].geometry.coordinates[len - 1];
        goal_pt = new Pos(coords[1], coords[0]);
        socket.emit("thief_goal_pt", {"lat": goal_pt.lat, "lng": goal_pt.lng });
        
        //get start positions of N cops
        var path = data.routes[0]['geometry']['coordinates'];
        var distance = data.routes[0].distance;
        var cop_start_pos = get_N_cop_spawn_positions(path, num_cops);
        socket.emit("cops_start_pos", {"cops_start_pos": cop_start_pos, "thief_loc": start_pt, "goal_pt": goal_pt});
        maputils.add_goal_pt(goal_pt);
    });
    

    // Initialize the Actor. In this case, a new thief first
    this.thief = new Actor(THIEF, 0, 9);
    this.thief.initialize(start_pt, goal_pt);
    this.thief.get_directions(maputils, thief_directions_updated);
    var user_clicked = false;
    
    function update_frame() {
        if(!game_over){
            this.thief.update_marker();
            maputils.panTo(this.thief.currentpos.lat, this.thief.currentpos.lng);
            socket.emit("thief_loc", {"lat": this.thief.currentpos.lat, "lng": this.thief.currentpos.lng });
            if (!this.thief.at_end_pt(maputils)) { 
                moveStep = setTimeout(update_frame, 100);
            } 
            else {
                //reached end of user clicked point
                if (user_clicked){
                    var distance_to_safehouse = maputils.distance(this.thief.currentpos, goal_pt);
                    moveStep = setTimeout(update_frame, 100);
                    if (distance_to_safehouse < 0.03){
                        game_over = true;
                        socket.emit("thief_won", "");
                        document.getElementById('features').innerHTML += "You reached the safehouse. \nGame Over.";
                    }
                }
                //reached safe house
                else{
                     game_over = true;
                     socket.emit("thief_won", "");
                     document.getElementById('features').innerHTML += "You reached the safehouse. \nGame Over.";
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
        user_clicked = true;
        document.getElementById('features').innerHTML += "You changed directions, is that wise? \n";
    });
}


//-------------------------------COP LOOP----------------------------------------------
function cop_game_loop(info) {
    var username = "myname";
    var my_id = null;
    var me = null;
    var thief = null;
    var moveStep;
    var user_clicked = false;
    
    // Start initializing the cop
    my_id = info.id;
    var my_pos = new Pos(info.pos.lat, info.pos.lng);
    
    var thief_loc = info.thief_loc;
    var goal_pt = info.goal_pt;
    maputils.panTo(my_pos.lat, my_pos.lng);

    if (thief_loc != null) {
        initialize_cop(my_pos, thief_loc, goal_pt);
    }
    ///////////////////////////////////////////////////

    function initialize_cop(cop_pos, thief_pos, goal_pt) {
        me = new Actor(COP, my_id, 10);
        me.initialize(cop_pos, thief_pos);
        maputils.add_goal_pt(goal_pt);
        me.get_directions(maputils, my_directions_updated);
        document.getElementById('features').innerHTML += "You joined the heist. Your id is " + my_id + "\n";
        socket.emit('cop_joined', my_id);
        
    
        map.on('click', function(e) {
            window.clearTimeout(moveStep);
            me.endpoint = new Pos(e['latlng']['lat'], e['latlng']['lng']);
            me.reset();
            // maputils.clearPath();
            me.get_directions(maputils, my_directions_updated);
            this.user_clicked = true;
        });
    }
    
    socket.on('cop_id', function(info) {

    });
    
    socket.on('previous_cops', function(msg) {
        var ordered_list = "";
        if (Object.keys(msg).length >= 1){
            document.getElementById('features').innerHTML += "Before you joined: \n";
            ordered_list = "\t";
        }
        for (var key in msg){
            if (key != my_id)
                document.getElementById('features').innerHTML += ordered_list + "Cop " + key + " joined the heist.\n";
        }
    
});

    
    socket.on('no_room', function(msg) {
        document.getElementById('features').innerHTML = "No more room on Server. Try again later!!!"
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
                     socket.emit('cop_won', my_id);
                     game_over = true;
                     document.getElementById('features').innerHTML += "You caught the thief! \nGame Over.";
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
        check_for_new_directions()
    }
    
    function update_my_frame() {
        if(!game_over){
            me.update_marker();
            // maputils.panTo(me.currentpos.lat, me.currentpos.lng);
            socket.emit("cop_loc", {"id": me.id, "lat": me.currentpos.lat, "lng": me.currentpos.lng });
            if (!me.at_end_pt(maputils)) {
                moveStep = setTimeout(update_my_frame, 100);
            } 
            // else if (user_clicked == false) {
            //     me.endpoint = thief.currentpos;
            //     me.reset();
            //     me.get_directions(maputils, my_directions_updated);
            // }
        }
    }
    
    // every 5 seconds update the cop's target goal based on thief's location
    function check_for_new_directions(){
         me.endpoint = thief.currentpos;
         me.reset();
         me.get_directions(maputils, my_directions_updated);
         setTimeout(check_for_new_directions, 500000000);
    }
}