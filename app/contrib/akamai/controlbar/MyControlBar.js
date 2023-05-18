var MyControlBar = function (streamElement, displayUTCTimeCodes = false) {

    var element = streamElement;
    var lastVolumeLevel = NaN;
    var videoControllerVisibleTimeout = null;
    var seeking = false;

    var videoContainer,
        videoController,
        playPauseBtn,
        bitrateListBtn,
        captionBtn,
        trackSwitchBtn,
        seekbar,
        seekbarPlay,
        seekbarBuffer,
        muteBtn,
        volumebar,
        fullscreenBtn,
        timeDisplay,
        durationDisplay,
        thumbnailContainer;

    var initialize = function () {

        try {
            if (!element) {
                throw "No avaliable video element!";
            }

            initControls();
            element.controls = false;
            // addPlayerEventsListeners();

            playPauseBtn.addEventListener('click', onPlayPauseClick);
            muteBtn.addEventListener('click', onMuteClick);
            fullscreenBtn.addEventListener('click', onFullscreenClick);
            seekbar.addEventListener('mousedown', onSeeking, true);
            // seekbar.addEventListener('mousemove', onSeekBarMouseMove, true);
            // seekbar.addEventListener('touchmove', onSeekBarMouseMove, { passive: true });
            // seekbar.addEventListener('mouseout', onSeekBarMouseMoveOut, true);
            // seekbar.addEventListener('touchcancel', onSeekBarMouseMoveOut, true);
            // seekbar.addEventListener('touchend', onSeekBarMouseMoveOut, true);
            volumebar.addEventListener('input', setVolume, true);
            document.addEventListener('fullscreenchange', onFullScreenChange, false);
            document.addEventListener('MSFullscreenChange', onFullScreenChange, false);
            document.addEventListener('mozfullscreenchange', onFullScreenChange, false);
            document.addEventListener('webkitfullscreenchange', onFullScreenChange, false);


        } catch (e) {
            window.alert("Error when initializing the control bar" + (e == "" ? "!" : ": " + e));
            return;
        }


    };

    var initControls = function () {
        videoContainer = document.getElementById('videoContainer');
        videoController = document.getElementById('videoController');
        playPauseBtn = document.getElementById('playPauseBtn');
        bitrateListBtn = document.getElementById('bitrateListBtn');
        captionBtn = document.getElementById('captionBtn');
        trackSwitchBtn = document.getElementById('trackSwitchBtn');
        seekbar = document.getElementById('seekbar');
        seekbarPlay = document.getElementById('seekbar-play');
        seekbarBuffer = document.getElementById('seekbar-buffer');
        muteBtn = document.getElementById('muteBtn');
        volumebar = document.getElementById('volumebar');
        fullscreenBtn = document.getElementById('fullscreenBtn');
        timeDisplay = document.getElementById('videoTime');
        durationDisplay = document.getElementById('videoDuration');
        thumbnailContainer = document.getElementById('thumbnail-container');
    };

    var onPlayPauseClick = function () {
        togglePlayPauseBtnState();
        element.paused ? element.play() : element.pause();
    };

    var togglePlayPauseBtnState = function () {
        element.paused ? setPlayBtn() : setPauseBtn();
    };

    var setPlayBtn = function () {
        var span = document.getElementById('icronPlayPause');
        if (span !== null) {
            span.classList.remove('icon-pause');
            span.classList.add('icon-play');
        }
    };

    var setPauseBtn = function () {
        var span = document.getElementById('icronPlayPause');
        if (span !== null) {
            span.classList.remove('icon-play');
            span.classList.add('icon-pause');
        }
    };

    var onMuteClick = function () {
        if (element.muted && !isNaN(lastVolumeLevel)) {
            setVolume(lastVolumeLevel);
        } else {
            lastVolumeLevel = parseFloat(volumebar.value);
            setVolume(0);
        }
        element.muted = (element.volume === 0);
        toggleMuteBtnState();
    };

    var setVolume = function (value) {
        if (typeof value === 'number') {
            volumebar.value = value;
        }
        element.volume = parseFloat(volumebar.value);
        element.muted = (element.volume === 0);
        if (isNaN(lastVolumeLevel)) {
            lastVolumeLevel = element.volume;
        }
        toggleMuteBtnState();
    };

    var toggleMuteBtnState = function () {
        var span = document.getElementById(getControlId('iconMute'));
        if (element.muted) {
            span.classList.remove('icon-mute-off');
            span.classList.add('icon-mute-on');
        } else {
            span.classList.remove('icon-mute-on');
            span.classList.add('icon-mute-off');
        }
    };

    var onFullscreenClick = function () {
        if (!isFullscreen()) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
        if (captionMenu) {
            captionMenu.classList.add('hide');
        }
        if (bitrateListMenu) {
            bitrateListMenu.classList.add('hide');
        }
        if (trackSwitchMenu) {
            trackSwitchMenu.classList.add('hide');
        }
    };

    var isFullscreen = function () {
        return document.fullscreenElement || document.msFullscreenElement || document.mozFullScreen || document.webkitIsFullScreen;
    };

    var enterFullscreen = function () {
        if(!document.fullscreenElement){
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else {
                element.webkitRequestFullScreen();
            }
        }
        videoController.classList.add('video-controller-fullscreen');
        window.addEventListener('mousemove', onFullScreenMouseMove);
        onFullScreenMouseMove();
    };

    var onFullScreenMouseMove = function () {
        clearFullscreenState();
        videoControllerVisibleTimeout = setTimeout(function () {
            videoController.classList.add('hide');
        }, 4000);
    };

    var clearFullscreenState = function () {
        clearTimeout(videoControllerVisibleTimeout);
        videoController.classList.remove('hide');
    };

    var exitFullscreen = function () {
        window.removeEventListener('mousemove', onFullScreenMouseMove);
        clearFullscreenState();
        if (document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else {
                document.webkitCancelFullScreen();
            }
        }
        videoController.classList.remove('video-controller-fullscreen');
    };
    
    var onSeeking = function (event) {
        seeking = true;
        var mouseTime = calculateTimeByEvent(event);
        if (seekbarPlay) {
            seekbarPlay.style.width = (mouseTime / element.duration * 100) + '%';   ///////////// TODO: isDynamic
        }
        setTime(mouseTime);
        // document.addEventListener('mousemove', onSeekBarMouseMove, true);
        document.addEventListener('mouseup', onSeeked, true);
    };

    var calculateTimeByEvent = function (event) {
        var seekbarRect = seekbar.getBoundingClientRect();
        return Math.floor(element.duration * (event.clientX - seekbarRect.left) / seekbarRect.width);   ///////////// TODO: isDynamic
    };

    var setTime = function (value) {
        if (value < 0) {
            return;
        }
        // if (self.player.isDynamic() && element.duration) {   ///////////// TODO: isDynamic
        //     var liveDelay = self.player.duration() - value;
        //     if (liveDelay < liveThresholdSecs) {
        //         durationDisplay.classList.add('live');
        //     } else {
        //         durationDisplay.classList.remove('live');
        //     }
        //     timeDisplay.textContent = '- ' + self.player.convertToTimeCode(liveDelay);
        // } else if (!isNaN(value)) {
        //     timeDisplay.textContent = displayUTCTimeCodes ? self.player.formatUTC(value) : self.player.convertToTimeCode(value);
        // }
        if (!isNaN(value)) {
            timeDisplay.textContent = displayUTCTimeCodes ? formatUTC(value) : convertToTimeCode(value);
        }
    };

    var formatUTC = function (time, locales, hour12, withDate = false) {
        const dt = new Date(time * 1000);
        const d = dt.toLocaleDateString(locales);
        const t = dt.toLocaleTimeString(locales, {
            hour12: hour12
        });
        return withDate ? t + ' ' + d : t;
    };

    var convertToTimeCode = function (value) {
        value = Math.max(value, 0);

        let h = Math.floor(value / 3600);
        let m = Math.floor((value % 3600) / 60);
        let s = Math.floor((value % 3600) % 60);
        return (h === 0 ? '' : (h < 10 ? '0' + h.toString() + ':' : h.toString() + ':')) + (m < 10 ? '0' + m.toString() : m.toString()) + ':' + (s < 10 ? '0' + s.toString() : s.toString());
    };

    // var onSeekBarMouseMove = function (event) {};

    var onSeeked = function (event) {
        seeking = false;
        // document.removeEventListener('mousemove', onSeekBarMouseMove, true);
        document.removeEventListener('mouseup', onSeeked, true);
        // seeking
        var mouseTime = calculateTimeByEvent(event);
        if (!isNaN(mouseTime)) {
            mouseTime = mouseTime < 0 ? 0 : mouseTime;
            // self.player.seek(mouseTime);   ///////////// TODO: isDynamic
            seek(mouseTime);
        }
        // onSeekBarMouseMoveOut(event);
        if (seekbarPlay) {
            seekbarPlay.style.width = (mouseTime / element.duration * 100) + '%';   ///////////// TODO: isDynamic
        }
    };

    var seek = function (time) {   ///////////// TODO: isDynamic
        let currentTime = element.currentTime;
        if (time === currentTime) return;
        /////////////////////////////////////
    }

    // var onSeekBarMouseMoveOut = function () {};

    var onFullScreenChange = function () {
        var icon;
        if (isFullscreen()) {
            enterFullscreen();
            icon = fullscreenBtn.querySelector('.icon-fullscreen-enter');
            icon.classList.remove('icon-fullscreen-enter');
            icon.classList.add('icon-fullscreen-exit');
        } else {
            exitFullscreen();
            icon = fullscreenBtn.querySelector('.icon-fullscreen-exit');
            icon.classList.remove('icon-fullscreen-exit');
            icon.classList.add('icon-fullscreen-enter');
        }
    };

    var setDuration = function (value) {
        // if (self.player.isDynamic()) {   ///////////// TODO: isDynamic
        //     durationDisplay.textContent = '● LIVE';
        //     if (!durationDisplay.onclick) {
        //         durationDisplay.onclick = seekLive;
        //         durationDisplay.classList.add('live-icon');
        //     }
        // } else if (!isNaN(value)) {
        //     durationDisplay.textContent = displayUTCTimeCodes ? self.player.formatUTC(value) : self.player.convertToTimeCode(value);
        //     durationDisplay.classList.remove('live-icon');
        // }
        if (!isNaN(value)) {
            durationDisplay.textContent = displayUTCTimeCodes ? formatUTC(value) : convertToTimeCode(value);
            durationDisplay.classList.remove('live-icon');
        }
    };

    return {
        initialize: initialize,
        setDuration: setDuration,
        setTime: setTime
        /////////////////////
    };

}