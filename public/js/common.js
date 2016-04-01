(function() {
    // Init the API key for mapbox.
    this.access_token = 'pk.eyJ1Ijoic3NhcmFuZ2kxMjMiLCJhIjoiY2ltOWpmeno4MDNwNHRubTZobW50Y2ljZiJ9.yidy_pQjADEQ8vD7j_m1hw'
    L.mapbox.accessToken = this.access_token;
    
    // Globals for the Mapbox server
    var map = L.mapbox.map('map', 'peterqliu.39d14f8b',{'scrollWheelZoom':true})
                  .setView([37.8, -96], 14);
                  
    var maputils = new MapUtils(map, this.access_token);
    var socket = io();

    var moveStep;
    
    function fly_to_current_loc() {
        if (window.navigator && window.navigator.geolocation) {
            var geolocation = window.navigator.geolocation;
            
            var positionOptions = {
                enableHighAccuracy: true,
                timeout: 10 * 1000, // 10 seconds
                maximumAge: 30 * 1000 // 30 seconds
            };
            
            function success(position) {
                var c_pos = position.coords;
                map.panTo([c_pos.latitude, c_pos.longitude]);
            }
            
            function error(positionError) {
                console.log(positionError.message);
            }
            
            if (geolocation) {
                geolocation.getCurrentPosition(success, error, positionOptions);
            }
        } else {
            console.log("Geolocation is prevented on your browser");
        }
    }
    
    // Do not fly to the current location
    // fly_to_current_loc();

    function thief_directions_updated() {
        maputils.draw_path(this.thief.linestring);
        this.thief.add_icon(maputils);
        
        // Move the map the where the thief is.
        maputils.panTo(this.thief.startpoint.lat, this.thief.startpoint.lng);
        
        window.clearTimeout(moveStep);
        update_frame();
    }

    // Initialize the Actor. In this case, a new thief first
    this.thief = new Thief();
    this.thief.initialize(new Pos(37.78, -122.42), new Pos(37.796931, -122.265491));
    this.thief.get_directions(maputils, this.thief.startpoint, this.thief.endpoint, thief_directions_updated);
    
    function update_frame() {
        this.thief.update_marker();
        maputils.panTo(this.thief.currentpos.lat, this.thief.currentpos.lng);
        socket.emit("thief_loc", {"lat": this.thief.currentpos.lat, "lng": this.thief.currentpos.lng });
        if (!this.thief.at_end_pt()) { moveStep = setTimeout(update_frame, 250); }
    }
})();
