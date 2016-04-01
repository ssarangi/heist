function Pos(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    
    this.array = function() {
        return [this.lat, this.lng];
    }
}

var THIEF = 0;
var COP = 1

// http://www.livetrain.nyc/

function Actor(type, id) {
    this.icon = {
        icon: L.divIcon({
                className: 'couriericon ' + getColorNameFromId(id),
                html: '',
                iconSize: [15, 15]
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
        var actor = this;
        var start_pt = actor.startpoint;
        var end_pt = actor.endpoint;
        
        map_utils.get_directions([start_pt.lng, start_pt.lat], [end_pt.lng, end_pt.lat], function(data) {
            actor.path = data.routes[0]['geometry']['coordinates'];
            // actor.path = data.routes[0].geometry.coordinates;
            actor.linestring = turf.linestring(actor.path, {
                  "stroke": "#" + getColorHexFromId(actor.id),
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
        
        if (this.where_in_path >= 0 && this.where_in_path < this.linestring.geometry.coordinates.length) {
            var coords = this.linestring.geometry.coordinates[this.where_in_path];
            this.currentpos = new Pos(coords[1], coords[0]);
            return coords;
        } else {
            return null;
        }
    }
    
    this.update_marker = function() {
        if (this.marker != null) {
            var next_step = this.next_path_step();
            if (next_step != null)
                this.marker.setLatLng(L.latLng([next_step[1], next_step[0]]));
        } else {
            return Error("Path tracing not initialized");
        }
    }
    
    this.update_networked_marker = function(pos) {
        if (this.marker != null) {
            this.currentpos = pos;
            this.marker.setLatLng([pos.lat, pos.lng]);
        }
    }
    
    this.at_end_pt = function() {
        if (this.where_in_path == this.linestring.geometry.coordinates.length)
            return true;
            
        return false;
    }
}

function NPCActor(id) {
    this.icon = {
        icon: L.divIcon({
                className: 'couriericon ' + getColorNameFromId(id),
                html: '',
                iconSize: [15, 15]
            })
    };
    
    this.marker = null;
    this.currentpos = null;
    this.linestring = null;
    
    this.add_icon = function(map_utils) {
        if (this.currentpos != null) {
            this.marker = map_utils.add_icon(this.icon, this.currentpos.array());
        }
    }
    
    this.update_marker = function(lat, lng) {
        if (this.marker != null) {
            this.marker.setLatLng([lat, lng]);
        }
    }
}