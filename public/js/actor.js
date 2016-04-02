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
    var icon_txt = id;
    if (type == THIEF) {
        this.icon = {
        icon: L.divIcon({
                className: 'couriericon ',
                html: '<img class="hq" src="../img/thief.png">',
                iconSize: [25, 25]
            })
    };
    }
    else {
        this.icon = {
        icon: L.divIcon({
                className: 'couriericon ',
                html: '<img class="hq" src="../img/police.png">',
                iconSize: [30, 30]
            })
    };
    }
    this.marker = null;
    
    this.currentpos = null;
    this.startpoint = null;
    this.endpoint = null;
    this.path = null;
    this.linestring = null;
    this.type = type;
    this.id = id;
    
    this.trip_distance = null;
    this.trip_duration = null;
    this.increment = 0;
    this.pollingInterval = 10;
    
    this.reset = function() {
        this.startpoint = this.currentpos;
        this.increment = 0;
    }

    this.get_directions = function(map_utils, on_complete) {
        var actor = this;
        var start_pt = actor.startpoint;
        var end_pt = actor.endpoint;
        
        map_utils.get_directions([start_pt.lng, start_pt.lat], [end_pt.lng, end_pt.lat], function(data) {
            actor.path = data.routes[0]['geometry']['coordinates'];
            actor.trip_distance = data.routes[0].distance;
            actor.trip_duration = (data.routes[0].duration/(60*3.2)).toFixed(0);
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
            this.increment++;
        }
        
        try {
            var waypoint = turf.along(this.linestring, (this.increment * this.trip_distance * this.pollingInterval) / (this.trip_duration * 1000 * 1000), 'miles').geometry.coordinates;
            this.currentpos = new Pos(waypoint[1], waypoint[0]);
            return waypoint;
        } catch (err) {
            console.log(err.message);
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
    
    this.at_end_pt = function(maputils) {
        var distance = maputils.distance(this.currentpos, this.endpoint);
        if (distance < 0.03)
        {
            this.currentpos = this.endpoint;
            this.update_marker();
            return true;
        }
        return false;
    }
}

function NPCActor(id) {
    var icon_txt = id;

    this.icon = {
        icon: L.divIcon({
                className: 'couriericon ' + getColorNameFromId(id),
                html: icon_txt,
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