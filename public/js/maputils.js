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
    
    this.clearPath = function() {
        $('path').remove();
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
    
    this.draw_new_path = function(id, path) {
        function reverseCoords(pair) {return [pair[1], pair[0]]}
        var processedCoords = path.map(function(n){return reverseCoords(n)});
        var color_name = getColorNameFromId(id);
        var color_val = getColorHexFromId(id);
        
        $('.'+ color_name + 'path').remove();
        
        var polyline_options = {
            color: '#' + color_val,
            opacity: 1,         // Stroke opacity
            weight: 3,         // Stroke weight
            fillColor: '#' + color_val,  // Fill color
            fillOpacity: 1,    // Fill opacity
            className: color_name + 'path' // Class name for the polyline object
        };
        
        var courierRoute = 
            L.polyline(processedCoords, polyline_options).addTo(this.map);
            
        $('path').css('stroke-dashoffset',0)
    }
    
    this.distance = function(p1, p2) {
        var point1 = {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "Point",
            "coordinates": [p1.lng, p1.lat]
          }
        };

        var point2 = {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "Point",
            "coordinates": [p2.lng, p2.lat]
          }
        };
        
        var units = "miles";
        var distance = turf.distance(point1, point2, units);
        return distance;
    }
    
    this.add_goal_pt = function(goal_pt) {
        var hq =
        {
          "type": "FeatureCollection",
          "features": [
            {
              "type": "Feature",
              "properties": {},
              "geometry": {
                "type": "Point",
                "coordinates": [goal_pt.lng, goal_pt.lat],
              }
            },
          ]
        };
        
    
        function reverseCoords(pair) {return [pair[1], pair[0]]}
    
        hq.features.forEach(function(n) {
            L.marker(
              reverseCoords(n.geometry.coordinates),
              {icon: L.divIcon({
              className: 'goal',
              iconSize: [20, 20],
              html: '<img class="hq" src="../img/thief_goal.png">'
              })}
            ).addTo(map);
        });
    }
}