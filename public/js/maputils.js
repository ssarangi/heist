function MapUtils(map, access_token) {
    this.map = map;
    this.access_token = access_token;
    
    this.panTo = function(lat, lng) {
        this.map.panTo([lat, lng]);
    }
    
    this.addLayer = function(geoJSON) {
        L.mapbox.featureLayer().setGeoJSON(geoJSON).addTo(this.map);
        $('path').css('stroke-offset'); // used just to delay before animating
        $('path').css('stroke-dashoffset',0);
    }
    
    this.get_directions = function(p1, p2, callback) {
        var points = [p1, p2];
        var waypoints= JSON.stringify(points).replace(/\],\[/g, ";").replace(/\[/g,'').replace(/\]/g,'');
        var directionsAPI = 'https://api.tiles.mapbox.com/v4/directions/mapbox.driving/'+ waypoints +'.json?access_token='+ this.access_token;
        $.get(directionsAPI, callback);
    }
    
    this.add_icon = function(icon, pos) {
        return L.marker(pos, icon).addTo(map);
    }
    
    this.draw_path = function(linestring) {
        this.addLayer(linestring);
    }
}