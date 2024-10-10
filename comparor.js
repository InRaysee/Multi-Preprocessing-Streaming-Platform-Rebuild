'use strict';

var comparor = function () {

    const appElement = document.querySelector('[ng-controller=DashController]');
    const $scope = window.angular ? window.angular.element(appElement).scope() : undefined;
    const videoElement = document.getElementById('comparison');
    var player = null;

    const init = function () {

        var url = $scope.streamURLforComparison;

        if (!url || url == "") {
            window.alert("Wrong streamURL for comparor: Empty URL!");
            return false;
        }
        if (!url || url.slice(-4) !== ".mpd") {
            window.alert("Wrong streamURL for comparor: Not a .mpd URL!");
            return false;
        }

        player = dashjs.MediaPlayer().create();
        player.initialize(videoElement, url, true);

    };

    const destroy = function () {
        
        if (player) {
            player.destroy();
            player = null;
        }

    }
    
    return {
        init: init,
        destroy: destroy
    };

};



