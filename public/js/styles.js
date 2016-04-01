var colors = {
  'Blue':'456E75',
  'Green':'8F9957',
  'Orange':'B87C51',
  'Red':'B04548',
  'Purple':'5C2E58',
  'Yellow': 'B3A800',
};

var IDToStyle = {
    "0": "Yellow",
    "1": "Blue",
    "2": "Green",
    "3": "Orange",
    "4": "Red",
    "5": "Purple",
}

function getColorNameFromId(id) {
    var color = IDToStyle[id];
    return color;
}

function getColorHexFromId(id) {
    var color = IDToStyle[id];
    var hex = colors[color];
    return hex;
}