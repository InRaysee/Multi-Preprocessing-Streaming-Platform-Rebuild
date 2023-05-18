var MyControlBar = function (streamElement) {

    var element = streamElement;
    var lastVolumeLevel = NaN;

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
        thumbnailContainer,
        thumbnailElem,
        thumbnailTimeLabel;

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

        } catch (e) {
            window.alert("Error when initializing the control bar" + (e == "" ? "!" : ": " + e));
            return;
        }


    }

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
        thumbnailElem = document.getElementById('thumbnail-elem');
        thumbnailTimeLabel = document.getElementById('thumbnail-time-label');
    }

    var onPlayPauseClick = function () {
        togglePlayPauseBtnState();
        element.paused ? element.play() : element.pause();
    }

    var togglePlayPauseBtnState = function () {
        element.paused ? setPlayBtn() : setPauseBtn();
    }

    var setPlayBtn = function () {
        var span = document.getElementById('icronPlayPause');
        if (span !== null) {
            span.classList.remove('icon-pause');
            span.classList.add('icon-play');
        }
    }

    var setPauseBtn = function () {
        var span = document.getElementById('icronPlayPause');
        if (span !== null) {
            span.classList.remove('icon-play');
            span.classList.add('icon-pause');
        }
    }

    var onMuteClick = function () {
        if (element.muted && !isNaN(lastVolumeLevel)) {
            setVolume(lastVolumeLevel);
        } else {
            lastVolumeLevel = parseFloat(volumebar.value);
            setVolume(0);
        }
        element.muted = (element.volume === 0);
        toggleMuteBtnState();
    }

    var setVolume = function (value) {
        volumebar.value = value;
        element.volume = parseFloat(volumebar.value);
        element.muted = (element.volume === 0);
        if (isNaN(lastVolumeLevel)) {
            lastVolumeLevel = element.volume;
        }
        toggleMuteBtnState();
    }

    var toggleMuteBtnState = function () {
        var span = document.getElementById(getControlId('iconMute'));
        if (element.muted) {
            span.classList.remove('icon-mute-off');
            span.classList.add('icon-mute-on');
        } else {
            span.classList.remove('icon-mute-on');
            span.classList.add('icon-mute-off');
        }
    }

    return {
        initialize: initialize
        /////////////////////
    };

}