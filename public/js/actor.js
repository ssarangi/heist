function Pos(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    
    this.array = function() {
        return [this.lat, this.lng];
    }
}

var THIEF = 0;
var COP = 1

function Actor(type, id) {
    this.icon = {
        icon: L.divIcon({
                className: 'vehicle',
                html: '<div style="width:18px; height:18px; background:green; border-radius:50%; border:4px solid white"></div>',
                iconSize: [20, 20]
            })
    };
    this.marker = null;
    
    this.currentpos = null;
    this.startpoint = null;
    this.endpoint = null;
    this.path = null;
    this.linestring = null;
    this.type = type;
    this.id = id;
    
    this.where_in_path = -1;
    
    this.reset = function() {
        this.where_in_path = 0;
        this.startpoint = this.currentpos;
    }

    this.get_directions = function(map_utils, on_complete) {
        var thief = this;
        var start_pt = thief.startpoint;
        var end_pt = thief.endpoint;
        
        map_utils.get_directions([start_pt.lng, start_pt.lat], [end_pt.lng, end_pt.lat], function(data) {
            thief.path = data.routes[0]['geometry']['coordinates'];
            thief.linestring = turf.linestring(thief.path, {
                  "stroke": "green",
                  "stroke-width": 4
            });             
            on_complete();
        });
    }
    
    this.initialize = function(startpoint, endpoint) {
        this.currentpos = startpoint;
        this.startpoint = startpoint;
        this.endpoint = endpoint;
    }
    
    this.add_icon = function(map_utils) {
        if (this.marker == null) {
            this.marker = map_utils.add_icon(this.icon, this.startpoint.array());
        }
    }
    
    this.next_path_step = function() {
        if (this.path != null) {
            this.where_in_path += 1;
        }
        
        if (this.where_in_path >= 0) {
            var coords = this.linestring.geometry.coordinates[this.where_in_path];
            this.currentpos = new Pos(coords[1], coords[0]);
            return coords;
        } else {
            return Error("Path tracing is not initialized");
        }
    }
    
    this.update_marker = function() {
        if (this.marker != null) {
            var next_step = this.next_path_step();
            this.marker.setLatLng(L.latLng([next_step[1], next_step[0]]));
        } else {
            return Error("Path tracing not initialized");
        }
    }
    
    this.at_end_pt = function() {
        if (this.where_in_path == this.linestring.geometry.coordinates.length)
            return true;
            
        return false;
    }
}