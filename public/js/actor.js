function Pos(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    
    this.array = function() {
        return [this.lat, this.lng];
    }
}

function Thief() {
    this.icon = {
        icon: L.divIcon({
                className: 'vehicle',
                html: '<div style="width:18px; height:18px; background:green; border-radius:50%; border:4px solid white"></div>',
                iconSize: [20, 20]
            })
    };
    
    this.current_pos = null;
    this.startpoint = null;
    this.endpoint = null;
    this.path = null;

    this.get_directions = function(map_utils, start_pt, end_pt, on_complete) {
        var thief = this;
        map_utils.get_directions([start_pt.lng, start_pt.lat], [end_pt.lng, end_pt.lat], function(data) {
            thief.path = data;
            on_complete();
        });
    }
    
    this.initialize = function(startpoint, endpoint) {
        this.current_pos = startpoint;
        this.startpoint = startpoint;
        this.endpoint = endpoint;
    }
    
    this.add_icon = function(map_utils) {
        map_utils.add_icon(this.icon, this.startpoint.array());
    }
    
    this.path_coords = function() {
        if (this.path != null) {
            return this.path.routes[0]['geometry']['coordinates'];
        }
        else
            return null;
    }
}