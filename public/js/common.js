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
        
        // Move the map to where the thief is.
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
        if (!this.thief.at_end_pt()) { 
            moveStep = setTimeout(update_frame, 100);
        } else {
            this.thief.currentpos = this.thief.startpoint;
            this.thief.reset();
            moveStep = setTimeout(update_frame, 100);
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

    var cop_markers = {}

    // filters away the points which are not on roads
    function filter_unreasonable_points(list_of_points){
        var filtered_points = [];
        var parks = "parks";
        var water = "water";
        var road = "road";
        for (var i = 0; i < list_of_points.length; i++){
            var coords = list_of_points[i];
            var point = mapgl.project({'lng': coords[0], 'lat': coords[1]});
            var features = mapgl.queryRenderedFeatures(point);
            for(var j = 0; j < features.length; j++){
                var obj = features[j]['layer']['id'];
                // if(obj.indexOf(parks) == -1 && obj.indexOf(water) == -1){
                //     filtered_points.push(list_of_points[i]);
                // }
                if(obj.indexOf(road) > -1){
                    filtered_points.push(list_of_points[i]);
                }
            }
        }
        return filtered_points;
    }
    
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

    function generate_cop_starting_position(thief_pos) {
       var center_feature = {
            'type' : 'Features',
            "properties": {},
            'geometry' : {
                'type' : 'Point',
                'coordinates' : [thief_pos.lng, thief_pos.lat]
            },
            'properties' : {
                'name' : 'Thief Loc'
            }
        };
        
        var one_mile_out = turf.buffer(center_feature, 1, 'miles');
        var features = one_mile_out['features']
        var geometry = features[0]['geometry']
        var list_of_points = geometry['coordinates'][0]
        var random_indexes = get_N_random_numbers(1, list_of_points.length);
        
        for (var key in random_indexes) {
            var coords = list_of_points[random_indexes[key]];
            var cop_starting_point = new Pos(coords[1], coords[0]);
            return cop_starting_point;
        }
    }

    // Emit a new request
    if (my_id == null)
        socket.emit("new_cop_request", username);
    
    socket.on('cop_id', function(info) {
        my_id = info["id"];
        var thief_loc = info.thief_loc;
       
        if (thief_loc != null) {
            initialize_cop(thief_loc);
        }
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

         var pos = new Pos(loc["lat"], loc["lng"]);
         thief.update_networked_marker(loc);
    });
    
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
        me.update_marker();
        maputils.panTo(me.currentpos.lat, me.currentpos.lng);
        socket.emit("cop_loc", {"id": me.id, "lat": me.currentpos.lat, "lng": me.currentpos.lng });
        if (!me.at_end_pt()) { moveStep = setTimeout(update_my_frame, 100); }
    }
    
    function initialize_cop(thief_loc) {
        me = new Actor(COP, my_id);
        var thief_pos = new Pos(thief_loc["lat"], thief_loc["lng"]);
        maputils.panTo(thief_pos.lat, thief_pos.lng);

        var cop_pos = generate_cop_starting_position(thief_pos)
        me.initialize(cop_pos, thief_pos);
        me.get_directions(maputils, my_directions_updated);
    }
    
    map.on('click', function(e) {
        window.clearTimeout(moveStep);
        me.endpoint = new Pos(e['latlng']['lat'], e['latlng']['lng']);
        me.reset();
        // maputils.clearPath();
        me.get_directions(maputils, my_directions_updated);
    });
}