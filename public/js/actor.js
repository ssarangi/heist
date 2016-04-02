var THIEF = 0;
var COP = 1

// http://www.livetrain.nyc/

function Actor(type, id) {    
    this.currentpos = null;
    this.currentpossrc = null;
    this.internal_current_pos = null;
    
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
    this.direction_src_added = false;
    this.direction_src = null;

    this.reset = function() {
        this.startpoint = this.currentpos;
        this.increment = 0;
    }

    this.get_directions = function(map_utils, on_complete) {
        var actor = this;
        var start_pt = actor.startpoint;
        var end_pt = actor.endpoint;
        
        map_utils.get_directions([start_pt.lng, start_pt.lat], [end_pt.lng, end_pt.lat], function(data) {
            actor.path = data.routes[0].geometry.coordinates;
            actor.trip_distance = data.routes[0].distance;
            actor.trip_duration = (data.routes[0].duration/(60*3.2)).toFixed(0);
            var geoJSON = {
                                "type": "Feature",
                                "properties": {},
                                "geometry": {
                                    "type": "LineString",
                                    "coordinates": actor.path
                                }
                          };

            if (!actor.direction_src_added) {
                actor.direction_src = new mapboxgl.GeoJSONSource({ "data": geoJSON });

                map.addSource("route_" + actor.id, actor.direction_src);

                map.addLayer({
                    "id": "route_" + actor.id,
                    "type": "line",
                    "source": "route_" + actor.id,
                    "layout": {
                        "line-join": "round",
                        "line-cap": "round"
                    },
                    "paint": {
                        "line-color": getColorHexFromId(actor.id),
                        "line-width": 4
                    }
                });

                actor.direction_src_added = true;
            }

            actor.direction_src.setData(geoJSON);
            actor.linestring = turf.linestring(actor.path, {
                  "stroke": "#" + getColorHexFromId(actor.id),
                  "stroke-width": 4
            });

            on_complete();
        });
    }
    
    this.initialize = function(startpoint, endpoint) {
        this.currentpos = startpoint;
        this.internal_current_pos = {
            "type": "Point",
            "coordinates": [this.currentpos.lng, this.currentpos.lat],
        };

        // add the GeoJSON above to a new vector tile source
        this.currentpossrc = new mapboxgl.GeoJSONSource({
            data: this.internal_current_pos
        });

        this.startpoint = startpoint;
        this.endpoint = endpoint;
    }
    
    this.add_icon = function(map_utils) {
        var actor_id = "actor_" + this.id;
        map_utils.map.addSource(actor_id, this.currentpossrc);
        map_utils.map.addLayer({
            "id": actor_id,
            "type": "circle",
            "source": actor_id,
            "paint": {
                "circle-radius": 10,
                "circle-color": getColorHexFromId(this.id),
                "circle-opacity": 1.0
            }
        });
    }
    
    this.next_path_step = function() {
        if (this.path != null) {
            this.increment++;
        }
        
        try {
            var waypoint = turf.along(this.linestring, (this.increment * this.trip_distance * this.pollingInterval) / (this.trip_duration * 1000 * 1000), 'miles').geometry.coordinates;
            this.update_current_pos(new mapboxgl.LngLat(waypoint[0], waypoint[1]));
            return waypoint;
        } catch (err) {
            console.log(err.message);
        }
    }
    
    this.update_marker = function() {
        var next_step = this.next_path_step();
    }
    
    this.at_end_pt = function(maputils) {
        var distance = maputils.distance(this.currentpos, this.endpoint);
        if (distance < 0.03)
        {
            this.update_current_pos(this.endpoint);
            this.update_marker();
            return true;
        }
        return false;
    }

    this.update_current_pos = function(new_pos) {
        this.currentpos = new_pos;
        this.internal_current_pos.coordinates[0] = new_pos.lng;
        this.internal_current_pos.coordinates[1] = new_pos.lat;
        this.currentpossrc.setData(this.internal_current_pos);
    }
}

function NPCActor(id) {
    var icon_txt = id;

    this.id = id;
    this.currentpos = null;
    this.currentpossrc = null;
    this.internal_current_pos = null;
    this.direction_src_added = false;
    this.direction_src = null;

    this.linestring = null;

    this.initialize = function(current_pos) {
       this.internal_current_pos = {
            "type": "Point",
            "coordinates": [current_pos.lng, current_pos.lat],
        };

        // add the GeoJSON above to a new vector tile source
        this.currentpossrc = new mapboxgl.GeoJSONSource({
            data: this.internal_current_pos
        });

        this.update_current_pos(current_pos);        
    }
    
    this.add_icon = function(map_utils) {
        var actor_id = "actor_" + this.id;
        map_utils.map.addSource(actor_id, this.currentpossrc);
        map_utils.map.addLayer({
            "id": actor_id,
            "type": "circle",
            "source": actor_id,
            "paint": {
                "circle-radius": 10,
                "circle-color": getColorHexFromId(this.id),
                "circle-opacity": 1.0
            }
        });
    }
    
    this.update_current_pos = function(new_pos) {
        this.currentpos = new_pos;
        this.internal_current_pos.coordinates[0] = new_pos.lng;
        this.internal_current_pos.coordinates[1] = new_pos.lat;
        this.currentpossrc.setData(this.internal_current_pos);
    }

    this.draw_path = function(path) {
        var geoJSON = {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": path
                    }
              };

        if (!this.direction_src_added) {
            this.direction_src = new mapboxgl.GeoJSONSource({ "data": geoJSON });

            map.addSource("route_" + this.id, this.direction_src);

            map.addLayer({
                "id": "route_" + this.id,
                "type": "line",
                "source": "route_" + this.id,
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": getColorHexFromId(this.id),
                    "line-width": 4
                }
            });

            this.direction_src_added = true;
        }

        this.direction_src.setData(geoJSON);
    }
}