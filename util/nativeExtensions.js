if (!Date.timestamp) {
    Date.timestamp = function() { return new Date().getTime(); }
}
