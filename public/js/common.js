// Init the API key for mapbox.
this.access_token = 'pk.eyJ1Ijoic3NhcmFuZ2kxMjMiLCJhIjoiY2ltOWpmeno4MDNwNHRubTZobW50Y2ljZiJ9.yidy_pQjADEQ8vD7j_m1hw'
mapboxgl.accessToken = this.access_token;

// Globals for the Mapbox server
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v8',
    center: [-122.265491, 37.796931],
    zoom: 12
});

var maputils = new MapUtils(map, this.access_token);
var socket = io();
var cop_markers = {}

function cop_location_changed(user_data) {
    var id = user_data['id'];
    var lat = user_data['lat'];
    var lng = user_data['lng'];
    
    if (!(id in cop_markers)) {
        cop_markers[id] = new NPCActor(id);
        cop_markers[id].initialize(new mapboxgl.LngLat(lng, lat));
        cop_markers[id].add_icon(maputils);
    }
    
    cop_markers[id].update_current_pos(new mapboxgl.LngLat(lng, lat));
}

socket.on('thief_won', function(msg) {
    alert("Thief Won the game");
});

socket.on('thief_goal_pt', function(user_data) {
    var pos = new mapboxgl.LngLat(user_data['lng'], user_data['lat']);
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
        var point = new mapboxgl.LngLat(coords[0], coords[1]);
        return point;
    }
}

function thief_game_loop() {
    var moveStep;
    var thief = null;
    var start_pt = new mapboxgl.LngLat(-122.265491, 37.796931);

    function thief_directions_updated() {
        // maputils.draw_path(thief.linestring);
        
        // Move the map to where the thief is.
        maputils.panTo(thief.startpoint.lat, thief.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_frame();
    }

    function update_frame() {
        thief.update_marker();
        maputils.panTo(thief.currentpos.lat, thief.currentpos.lng);
        socket.emit("thief_loc", {"lat": thief.currentpos.lat, "lng": thief.currentpos.lng });
        if (!thief.at_end_pt(maputils)) { 
            moveStep = setTimeout(update_frame, 100);
        } else {
            var distance = maputils.distance(thief.currentpos, goal_pt);
            if (distance < 0.05) {
                socket.emit("thief_won", "");
                alert("Thief Won");
            } else {
                thief.currentpos = thief.startpoint;
                thief.reset();
                moveStep = setTimeout(update_frame, 100);
            }
        }
    }

    map.on('style.load', function () {
        var goal_pt = generate_position_within_radius(start_pt, 15);
        maputils.get_directions([start_pt.lng, start_pt.lat], [goal_pt.lng, goal_pt.lat], function(data) {
            var len = data.routes[0].geometry.coordinates.length;
            var coords = data.routes[0].geometry.coordinates[len - 1];
            goal_pt = new mapboxgl.LngLat(coords[0], coords[1]);
            socket.emit("thief_goal_pt", {"lat": goal_pt.lat, "lng": goal_pt.lng });
            maputils.add_goal_pt(goal_pt);
        });
        
        // Initialize the Actor. In this case, a new thief first
        thief = new Actor(THIEF, 0);
        thief.initialize(start_pt, goal_pt);
        thief.add_icon(maputils);
        thief.get_directions(maputils, thief_directions_updated);

        socket.on("cop_loc", cop_location_changed);
    });
    
    map.on('click', function(e) {
        window.clearTimeout(moveStep);
        thief.endpoint = new mapboxgl.LngLat(e['lngLat']['lng'], e['lngLat']['lat']);
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

    map.on('style.load', function () {
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

        socket.on("cop_loc", cop_location_changed);

        socket.on('no_room', function(msg) {
            alert("No more room on Server. Try again later!!!");
        });
        
        socket.on('thief_loc', function(loc) {
             if (thief == null) {
                 thief = new NPCActor(0);;
                 thief.initialize(new mapboxgl.LngLat(loc["lng"], loc["lat"]));
                 thief.add_icon(maputils);
            }

             var pos = new mapboxgl.LngLat(loc["lng"], loc["lat"]);
             thief.update_current_pos(new mapboxgl.LngLat(loc["lng"], loc["lat"]));
        });
        
        socket.on('cop_direction_changed', function(user_data) {
            var id = user_data['id'];
            var path = user_data['path'];
            cop_markers[id].draw_path(path);
        });
        
        function my_directions_updated() {
            // maputils.draw_new_path(me.id, me.path);
            socket.emit("cop_direction_changed", {"id": me.id, "path": me.path});
                        
            // Move the map to where I am moving
            maputils.panTo(me.startpoint.lat, me.startpoint.lng);
            
            window.clearTimeout(moveStep);
            update_my_frame();
        }
        
        function update_my_frame() {
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
        
        function initialize_cop(thief_loc, goal_pt) {
            me = new Actor(COP, my_id);
            var thief_pos = new mapboxgl.LngLat(thief_loc["lng"], thief_loc["lat"]);
            maputils.panTo(thief_pos.lat, thief_pos.lng);

            var cop_pos = generate_position_within_radius(thief_pos, 1);
            me.initialize(cop_pos, thief_pos);
            me.add_icon(maputils);
            
            // Add the final point of where the thief has to reach.
            maputils.add_goal_pt(goal_pt);
            // Now get directions to the end point of the cop which is the goal pt.
            me.get_directions(maputils, my_directions_updated);
        }
        
        map.on('click', function(e) {
            window.clearTimeout(moveStep);
            me.endpoint = new mapboxgl.LngLat(e['lngLat']['lng'], e['lngLat']['lat']);
            me.reset();
            // maputils.clearPath();
            me.get_directions(maputils, my_directions_updated);
            this.user_clicked = true;
        });
    });
}