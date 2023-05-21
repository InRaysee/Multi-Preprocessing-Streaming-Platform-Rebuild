var ControlBar = function (displayUTCTimeCodes = false) {

    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    var element = $scope.streamElement;
    var captionMenu = null;
    var bitrateListMenu = null;
    var trackSwitchMenu = null;
    var menuHandlersList = {
        bitrate: null,
        caption: null,
        track: null
    };
    var lastVolumeLevel = NaN;
    var seeking = false;
    var videoControllerVisibleTimeout = null;
    var liveThresholdSecs = 12;
    var textTrackList = {};
    var forceQuality = false;

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

    var addPlayerEventsListeners = function () {
        // self.player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, onPlayStart, this);
        // self.player.on(dashjs.MediaPlayer.events.PLAYBACK_PAUSED, onPlaybackPaused, this);
        // self.player.on(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, onPlayTimeUpdate, this);
        // self.player.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, onStreamActivated, this);
        // self.player.on(dashjs.MediaPlayer.events.STREAM_DEACTIVATED, onStreamDeactivated, this);
        // self.player.on(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, onStreamTeardownComplete, this);
        // self.player.on(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, onTracksAdded, this);
        // self.player.on(dashjs.MediaPlayer.events.BUFFER_LEVEL_UPDATED, onBufferLevelUpdated, this);
    };

    var removePlayerEventsListeners = function () {
        // self.player.off(dashjs.MediaPlayer.events.PLAYBACK_STARTED, onPlayStart, this);
        // self.player.off(dashjs.MediaPlayer.events.PLAYBACK_PAUSED, onPlaybackPaused, this);
        // self.player.off(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, onPlayTimeUpdate, this);
        // self.player.off(dashjs.MediaPlayer.events.STREAM_ACTIVATED, onStreamActivated, this);
        // self.player.off(dashjs.MediaPlayer.events.STREAM_DEACTIVATED, onStreamDeactivated, this);
        // self.player.off(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, onStreamTeardownComplete, this);
        // self.player.off(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, onTracksAdded, this);
        // self.player.off(dashjs.MediaPlayer.events.BUFFER_LEVEL_UPDATED, onBufferLevelUpdated, this);
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
        var span = document.getElementById('iconMute');
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
            seekbarPlay.style.width = (mouseTime / playerDuration() * 100) + '%';
        }
        setTime(mouseTime);
        // document.addEventListener('mousemove', onSeekBarMouseMove, true);
        document.addEventListener('mouseup', onSeeked, true);
    };

    var calculateTimeByEvent = function (event) {
        var seekbarRect = seekbar.getBoundingClientRect();
        return Math.floor(element.duration * (event.clientX - seekbarRect.left) / seekbarRect.width);
    };

    var setTime = function (value) {
        if (value < 0) {
            return;
        }
        if ($scope.streamIsDynamic && playerDuration()) {
            var liveDelay = playerDuration() - value;
            if (liveDelay < liveThresholdSecs) {
                durationDisplay.classList.add('live');
            } else {
                durationDisplay.classList.remove('live');
            }
            timeDisplay.textContent = '- ' + convertToTimeCode(liveDelay);
        } else if (!isNaN(value)) {
            timeDisplay.textContent = displayUTCTimeCodes ? formatUTC(value) : convertToTimeCode(value);
        }
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
            self.player.seek(mouseTime);
            seek(mouseTime);
        }
        // onSeekBarMouseMoveOut(event);
        if (seekbarPlay) {
            seekbarPlay.style.width = (mouseTime / playerDuration() * 100) + '%';
        }
    };

    var seek = function (value) {   ///////////// TODO: isDynamic
        // let time = $scope.streamIsDynamic ? getDVRSeekOffset(value) : value;
        // let currentTime = element.currentTime;
        // if (time === currentTime) return;
        // internalSeek = (internal === true);
        // if (!internalSeek) {
        //     seekTarget = time;
        //     eventBus.trigger(Events.PLAYBACK_SEEK_ASKED);
        // }
        // videoModel.setCurrentTime(time, stickToBuffered);
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
        if ($scope.streamIsDynamic) {
            durationDisplay.textContent = '● LIVE';
            if (!durationDisplay.onclick) {
                durationDisplay.onclick = seekLive;
                durationDisplay.classList.add('live-icon');
            }
        } else if (!isNaN(value)) {
            durationDisplay.textContent = displayUTCTimeCodes ? formatUTC(value) : convertToTimeCode(value);
            durationDisplay.classList.remove('live-icon');
        }
    };

    var seekLive = function () {
        seek(playerDuration());
    }

    var updateDuration = function () {
        var duration = playerDuration();
        if (duration !== parseFloat(seekbar.max)) { //check if duration changes for live streams..
            setDuration(displayUTCTimeCodes ? durationAsUTC(duration) : duration);
            seekbar.max = duration;
        }
    };

    var durationAsUTC = function (valToConvert) {
        // const type = streamController && streamController.hasVideoTrack() ? Constants.VIDEO : Constants.AUDIO;
        // let metric = dashMetrics.getCurrentDVRInfo(type);
        // let availableFrom,
        //     utcValue;
        // if (!metric) {
        //     return 0;
        // }
        // availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
        // utcValue = valToConvert + (availableFrom + metric.range.start);
        // return utcValue;
    }

    var timeAsUTC = function (valToConvert) {
        // const type = streamController && streamController.hasVideoTrack() ? Constants.VIDEO : Constants.AUDIO;
        // let metric = dashMetrics.getCurrentDVRInfo(type);
        // let availableFrom,
        //     utcValue;
        // if (!metric) {
        //     return 0;
        // }
        // availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
        // utcValue = valToConvert + (availableFrom + metric.range.start);
        // return utcValue;
    }

    var playerDuration = function () {   
        let d = element.duration;
        if ($scope.streamIsDynamic) {
            ///////////// TODO: isDynamic
            // const type = streamController && streamController.hasVideoTrack() ? Constants.VIDEO : Constants.AUDIO;
            // let metric = dashMetrics.getCurrentDVRInfo(type);
            // d = metric ? (metric.range.end - metric.range.start) : 0;
        }
        return d;
    }

    var playerTime = function () {
        let t = element.currentTime;
        if ($scope.streamIsDynamic) {
            // const type = streamController && streamController.hasVideoTrack() ? Constants.VIDEO : Constants.AUDIO;
            // let metric = dashMetrics.getCurrentDVRInfo(type);
            // t = (metric === null || t === 0) ? 0 : Math.max(0, (t - metric.range.start));
        }
        return t;
    }

    var createBitrateSwitchMenu = function (contentType) {
        var contentFunc;
        if (bitrateListBtn) {
            // destroyMenu(bitrateListMenu, bitrateListBtn, menuHandlersList.bitrate);
            bitrateListMenu = null;
            var availableBitrates = { menuType: 'bitrate' };
            if ($scope.streamInfo && $scope.streamInfo[contentType] && !isNaN($scope.streamInfo[contentType].pathIndex) && !isNaN($scope.streamInfo[contentType].periodIndex) && !isNaN($scope.streamInfo[contentType].adaptationSetIndex)
                 && $scope.streamBitrateLists && $scope.streamBitrateLists[contentType] && $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex]) {
                availableBitrates[contentType] = $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex];
            } else {
                availableBitrates[contentType] = [];
            }
            if (availableBitrates[contentType].length >= 1) {
                contentFunc = function (element, index) {
                    var result = isNaN(index) ? ' Auto Switch' : Math.floor(element.bandwidth / 1000) + ' kbps';
                    result += element && element.width && element.height ? ' (' + element.width + 'x' + element.height + ')' : '';
                    return result;
                };
                bitrateListMenu = createMenu(availableBitrates, contentFunc, contentType);
                var func = function () {
                    onMenuClick(bitrateListMenu, bitrateListBtn);
                };
                if (!menuHandlersList.bitrate) {
                    menuHandlersList.bitrate = func;
                    bitrateListBtn.addEventListener('click', func);
                }
                bitrateListBtn.classList.remove('hide');
            } else {
                bitrateListBtn.classList.add('hide');
            }
        }
    }

    var createTrackSwitchMenu = function (contentType, i) {
        var contentFunc;
        if (trackSwitchBtn) {
            // destroyMenu(trackSwitchMenu, trackSwitchBtn, menuHandlersList.track);
            trackSwitchMenu = null;
            var availableTracks = { menuType: 'track' };
            var periodIndex = NaN;
            if ($scope.streamMpds && $scope.streamMpds[contentType] && $scope.streamMpds[contentType][i] && $scope.streamMpds[contentType][i].Period) {
                for (let j = 0; j < $scope.streamMpds[contentType][i].Period.length; j++) {
                    if (!isNaN($scope.streamMpds[contentType][i].Period[j].start) && $scope.streamMpds[contentType][i].Period[j].start == 0) {
                        var periodIndex = j;
                        break;
                    }
                }
            }
            if (!isNaN(periodIndex) && $scope.streamMpds && $scope.streamMpds[contentType] && $scope.streamMpds[contentType][i] && $scope.streamMpds[contentType][i].Period && $scope.streamMpds[contentType][i].Period[periodIndex] && $scope.streamMpds[contentType][i].Period[periodIndex].AdaptationSet) {
                availableTracks[contentType] = $scope.streamMpds[contentType][i].Period[periodIndex].AdaptationSet;
                let j = 0;
                while (j < availableTracks[contentType].length) {
                    if (availableTracks[contentType][j].contentType != contentType) {
                        availableTracks[contentType].splice(j, 1);
                    } else {
                        j++;
                    }
                }
            } else {
                availableTracks[contentType] = [];
            }
            if (availableTracks[contentType].length >= 1) {
                contentFunc = function (element, index) {
                    var info = isNaN(index) ? ' Auto Switch' : '';
                    if (element && element.contentType) {
                        info += element.contentType.charAt(0).toUpperCase() + element.contentType.slice(1) + ' - ' + i;
                    }
                    if (element && element.id >= 0) {
                        info += ' - ID - ' + element.id;
                    }
                    return { info: info, pathIndex: isNaN(index) ? NaN : i };
                };
                trackSwitchMenu = createMenu(availableTracks, contentFunc, contentType);
                var func = function () {
                    onMenuClick(trackSwitchMenu, trackSwitchBtn);
                };
                if (!menuHandlersList.track) {
                    menuHandlersList.track = func;
                    trackSwitchBtn.addEventListener('click', func);
                }
                trackSwitchBtn.classList.remove('hide');
            }
        }
    };

    var createCaptionSwitchMenu = function () {
        // Subtitles/Captions Menu //XXX we need to add two layers for captions & subtitles if present.
        // var activeStreamInfo = player.getActiveStream().getStreamInfo();
        // if (captionBtn && (!activeStreamInfo.id || activeStreamInfo.id === streamId)) {
        //     destroyMenu(captionMenu, captionBtn, menuHandlersList.caption);
        //     captionMenu = null;
        //     var tracks = textTrackList[streamId] || [];
        //     var contentFunc = function (element, index) {
        //         if (isNaN(index)) {
        //             return 'OFF';
        //         }
        //         var label = getLabelForLocale(element.labels);
        //         if (label) {
        //             return label + ' : ' + element.type;
        //         }
        //         return element.lang + ' : ' + element.kind;
        //     };
        //     captionMenu = createMenu({ menuType: 'caption', arr: tracks }, contentFunc);
        //     var func = function () {
        //         onMenuClick(captionMenu, captionBtn);
        //     };
        // if (!menuHandlersList.caption) {
        //     menuHandlersList.caption = func;
        //     captionBtn.addEventListener('click', func);
        // }
        //     captionBtn.classList.remove('hide');
        // }
    };

    var destroyMenu = function (menu, btn, handler, menuType) {
        try {
            if (menu && videoController) {
                btn.removeEventListener('click', handler);
                videoController.removeChild(menu);
                menuHandlersList[menuType] = null;
            }
        } catch (e) {
        }
    };

    var destroyAllMenus = function () {
        try {
            if (bitrateListMenu && videoController) {
                bitrateListBtn.removeEventListener('click', menuHandlersList.bitrate);
                videoController.removeChild(bitrateListMenu);
            }
            if (trackSwitchMenu && videoController) {
                trackSwitchBtn.removeEventListener('click', menuHandlersList.track);
                videoController.removeChild(trackSwitchMenu);
            }
            if (captionMenu && videoController) {
                captionBtn.removeEventListener('click', menuHandlersList.caption);
                videoController.removeChild(captionMenu);
            }
        } catch (e) {
        }
    };

    var removeMenu = function (menu, btn) {
        try {
            if (menu) {
                videoController.removeChild(menu);
                menu = null;
                btn.classList.add('hide');
            }
        } catch (e) {
        }
    };

    var createMenu = function (info, contentFunc, contentType) {
        var menuType = info.menuType;
        if (!document.getElementById(menuType + 'Menu')) {
            var el = document.createElement('div');
            el.id = menuType + 'Menu';
            el.classList.add('menu');
            el.classList.add('hide');
            el.classList.add('unselectable');
            el.classList.add('menu-item-unselected');
            videoController.appendChild(el);
        } else {
            var el = document.getElementById(menuType + 'Menu');
        }
        switch (menuType) {
            case 'caption':
                // el.appendChild(document.createElement('ul'));
                // el = createMenuContent(el, getMenuContent(menuType, info.arr, contentFunc), 'caption', menuType + '-list', i);
                // setMenuItemsState(getMenuInitialIndex(info, menuType), menuType + '-list');
                // break;
            case 'track':
            case 'bitrate':
                if (info[contentType].length >= 1) {
                    if (!document.getElementById(contentType + '-' + menuType + '-control')) {
                        el.appendChild(createMediaTypeMenu(contentType, menuType));
                    }
                    el = createMenuContent(el, getMenuContent(menuType, info[contentType], contentFunc, contentType), contentType, contentType + '-' + menuType + '-list');
                    setMenuItemsState(getMenuInitialIndex(menuType, contentType), contentType + '-' + menuType + '-list');
                }
                break;
        }
        window.addEventListener('resize', handleMenuPositionOnResize, true);
        return el;
    };

    var createMediaTypeMenu = function (contentType, menuType) {
        var div = document.createElement('div');
        var title = document.createElement('div');
        var content = document.createElement('ul');
        div.id = contentType + '-' + menuType + '-control';
        title.textContent = contentType.charAt(0).toUpperCase() + contentType.slice(1);
        title.classList.add('menu-sub-menu-title');
        content.id = contentType + '-' + menuType + '-control-content';
        content.classList.add(contentType + '-menu-content');
        div.appendChild(title);
        div.appendChild(content);
        return div;
    };

    var getMenuContent = function (menuType, arr, contentFunc, contentType, autoswitch) {
        autoswitch = (autoswitch !== undefined) ? autoswitch : true;
        var content = [];
        arr.forEach(function (element, index) {
            content.push(contentFunc(element, index));
        });
        if ((menuType == 'track' || menuType == 'bitrate') && document.getElementById(contentType + '-' + menuType + '-control-content').children.length == 0 && autoswitch) {
            content.unshift(contentFunc(null, NaN));
        }
        return content;
    };

    var createMenuContent = function (menu, arr, contentType, name) {
        for (var i = 0; i < arr.length; i++) {
            var item = document.createElement('li');
            item.id = name + 'Item_' + i;
            item.index = i;
            item.contentType = contentType;
            item.name = name;
            item.selected = false;
            item.textContent = arr[i] instanceof Object ? arr[i].info : arr[i];
            item.pathIndex = arr[i] instanceof Object ? arr[i].pathIndex : NaN;
            item.onmouseover = function () {
                if (this.selected !== true) {
                    this.classList.add('menu-item-over');
                }
            };
            item.onmouseout = function () {
                this.classList.remove('menu-item-over');
            };
            item.onclick = setMenuItemsState.bind(item);
            var el;
            if (contentType === 'caption') {
                el = menu.querySelector('ul');
            } else {
                el = menu.querySelector('.' + contentType + '-menu-content');
            }
            el.appendChild(item);
        }
        return menu;
    };

    var getMenuInitialIndex = function (menuType, contentType) {
        if (menuType === 'track') {
            if ($scope.autoSwitchTrack[contentType]) {
                return 0;
            }
            if ($scope.streamInfo && $scope.streamInfo[contentType] && !isNaN($scope.streamInfo[contentType].adaptationSetIndex)) {
                return $scope.streamInfo[contentType].adaptationSetIndex;
            }
        } else if (menuType === 'bitrate') {
            if ($scope.autoSwitchBitrate[contentType]) {
                return 0;
            }
            if ($scope.streamInfo && $scope.streamInfo[contentType] && !isNaN($scope.streamInfo[contentType].adaptationSetIndex)) {
                return $scope.streamInfo[contentType].adaptationSetIndex;
            }
        } else if (menuType === 'caption') {
            // return self.player.getCurrentTextTrackIndex() + 1;
        }
        return 0;
    };

    var setMenuItemsState = function (value, type) {
        try {
            var item = typeof value === 'number' ? document.getElementById(type + 'Item_' + value) : this;
            if (item) {
                var nodes = item.parentElement.children;
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].selected = false;
                    nodes[i].classList.remove('menu-item-selected');
                    nodes[i].classList.add('menu-item-unselected');
                }
                item.selected = true;
                item.classList.remove('menu-item-over');
                item.classList.remove('menu-item-unselected');
                item.classList.add('menu-item-selected');
                if (type === undefined) { // User clicked so type is part of item binding.
                    if (item.name.slice(-12) == 'bitrate-list') {
                        if (item.index > 0) {
                            $scope.autoSwitchBitrate[item.contentType] = false;
                            $scope.streamInfo[item.contentType].representationIndex = item.index;
                            // self.player.setQualityFor(item.contentType, item.index - 1, forceQuality);  //////////////////////
                        } else {
                            $scope.autoSwitchBitrate[item.contentType] = true;
                        }
                    }
                    if (item.name.slice(-10) == 'track-list') {
                        if (item.index > 0) {
                            $scope.autoSwitchTrack[item.contentType] = false;
                            let index = -1;
                            for (let i = 0; i < nodes.length; i++) {
                                if (!isNaN(nodes[i].pathIndex) && nodes[i].pathIndex == item.pathIndex) {
                                    index++;
                                    if (nodes[i].textContent == item.textContent) {
                                        break;
                                    }
                                }
                            }
                            if (index == -1) {
                                throw "Cannot find the index of the selected adaptation set!";
                            }
                            $scope.streamInfo[item.contentType].pathIndex = item.pathIndex;
                            $scope.streamInfo[item.contentType].adaptationSetIndex = index;
                            changeBitrateListbyTrack();
                            // self.player.setCurrentTrack(self.player.getTracksFor(item.contentType)[item.index]);  //////////////////////
                        } else {
                            $scope.autoSwitchTrack[item.contentType] = true;
                        }
                    }
                    if (item.name.slice(-12) == 'caption-list') {
                        // self.player.setTextTrack(item.index - 1);  //////////////////////
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    var handleMenuPositionOnResize = function () {
        if (captionMenu) {
            positionMenu(captionMenu, captionBtn);
        }
        if (bitrateListMenu) {
            positionMenu(bitrateListMenu, bitrateListBtn);
        }
        if (trackSwitchMenu) {
            positionMenu(trackSwitchMenu, trackSwitchBtn);
        }
    };

    var positionMenu = function (menu, btn) {
        if (btn.offsetLeft + menu.clientWidth >= videoController.clientWidth) {
            menu.style.right = '0px';
            menu.style.left = '';
        } else {
            menu.style.left = btn.offsetLeft + 'px';
        }
        var menu_y = videoController.offsetTop - menu.offsetHeight;
        menu.style.top = menu_y + 'px';
    };

    var onMenuClick = function (menu, btn) {
        if (menu.classList.contains('hide')) {
            menu.classList.remove('hide');
            menu.onmouseleave = function (/*e*/) {
                this.classList.add('hide');
            };
        } else {
            menu.classList.add('hide');
        }
        menu.style.position = isFullscreen() ? 'fixed' : 'absolute';
        positionMenu(menu, btn);
    };

    var onPlayStart = function () {
        setTime(displayUTCTimeCodes ? timeAsUTC(playerTime()) : playerTime());
        updateplayerDuration();
        togglePlayPauseBtnState();
        if (seekbarBufferInterval) {
            clearInterval(seekbarBufferInterval);
        }
    }

    var onPlaybackPaused = function () {
        togglePlayPauseBtnState();
    }

    var onPlayTimeUpdate = function () {
        updateplayerDuration();
        if (!seeking) {
            setTime(displayUTCTimeCodes ? timeAsUTC(playerTime()) : playerTime());
            if (seekbarPlay) {
                seekbarPlay.style.width = (playerTime() / playerDuration() * 100) + '%';
            }

            if (seekbar.getAttribute('type') === 'range') {
                seekbar.value = playerTime();
            }
        }
    }

    var onStreamActivated = function (contentType, i) {  //////////////////////
        updateDuration();
        //Bitrate Menu
        if ($scope.streamInfo && $scope.streamInfo[contentType] && !isNaN($scope.streamInfo[contentType].pathIndex) && i == $scope.streamInfo[contentType].pathIndex) {
            createBitrateSwitchMenu(contentType);
        }
        //Track Switch Menu
        createTrackSwitchMenu(contentType, i);
        //Text Switch Menu
        createCaptionSwitchMenu(contentType, i);
    }

    var onStreamDeactivated = function (e) {  //////////////////////
        // if (e.streamInfo && textTrackList[e.streamInfo.id]) {
        //     delete textTrackList[e.streamInfo.id];
        // }
    }

    var onStreamTeardownComplete = function () {
        setPlayBtn();
        timeDisplay.textContent = '00:00';
    }
    
    var onTracksAdded = function (e) {  //////////////////////
        // if (!textTrackList[e.streamId]) {
        //     textTrackList[e.streamId] = [];
        // }
        // textTrackList[e.streamId] = textTrackList[e.streamId].concat(e.tracks);
        // createCaptionSwitchMenu(e.streamId);
    }

    var onBufferLevelUpdated = function () {  //////////////////////
        if (seekbarBuffer) {
            seekbarBuffer.style.width = ((playerTime() + getBufferLevel()) / playerDuration() * 100) + '%';
        }
    }

    var getBufferLevel = function () {  //////////////////////
        // var bufferLevel = 0;
        // if (self.player.getDashMetrics) {
        //     var dashMetrics = self.player.getDashMetrics();
        //     if (dashMetrics) {
        //         bufferLevel = dashMetrics.getCurrentBufferLevel('video', true);
        //         if (!bufferLevel) {
        //             bufferLevel = dashMetrics.getCurrentBufferLevel('audio', true);
        //         }
        //     }
        // }
        // return bufferLevel;
    };

    var onSeekBarMouseMoveOut = function (/*e*/) {
        // if (!thumbnailContainer) return;
        // thumbnailContainer.style.display = 'none';
    };

    var onSeekBarMouseMove = function (event) {
        // if (!thumbnailContainer || !thumbnailElem) return;

        // // Take into account page offset and seekbar position
        // var elem = videoContainer || video;
        // var videoContainerRect = elem.getBoundingClientRect();
        // var seekbarRect = seekbar.getBoundingClientRect();
        // var videoControllerRect = videoController.getBoundingClientRect();

        // // Calculate time position given mouse position
        // var left = event.clientX - seekbarRect.left;
        // var mouseTime = calculateTimeByEvent(event);
        // if (isNaN(mouseTime)) return;

        // // Update timer and play progress bar if mousedown (mouse click down)
        // if (seeking) {
        //     setTime(mouseTime);
        //     if (seekbarPlay) {
        //         seekbarPlay.style.width = (mouseTime / self.player.duration() * 100) + '%';
        //     }
        // }

        // // Get thumbnail information
        // if (self.player.provideThumbnail) {
        //     self.player.provideThumbnail(mouseTime, function (thumbnail) {

        //         if (!thumbnail) return;

        //         // Adjust left variable for positioning thumbnail with regards to its viewport
        //         left += (seekbarRect.left - videoContainerRect.left);
        //         // Take into account thumbnail control
        //         var ctrlWidth = parseInt(window.getComputedStyle(thumbnailElem).width);
        //         if (!isNaN(ctrlWidth)) {
        //             left -= ctrlWidth / 2;
        //         }

        //         var scale = (videoContainerRect.height * maxPercentageThumbnailScreen) / thumbnail.height;
        //         if (scale > maximumScale) {
        //             scale = maximumScale;
        //         }

        //         // Set thumbnail control position
        //         thumbnailContainer.style.left = left + 'px';
        //         thumbnailContainer.style.display = '';
        //         thumbnailContainer.style.bottom += Math.round(videoControllerRect.height + bottomMarginThumbnail) + 'px';
        //         thumbnailContainer.style.height = Math.round(thumbnail.height) + 'px';

        //         var backgroundStyle = 'url("' + thumbnail.url + '") ' + (thumbnail.x > 0 ? '-' + thumbnail.x : '0') +
        //             'px ' + (thumbnail.y > 0 ? '-' + thumbnail.y : '0') + 'px';
        //         thumbnailElem.style.background = backgroundStyle;
        //         thumbnailElem.style.width = thumbnail.width + 'px';
        //         thumbnailElem.style.height = thumbnail.height + 'px';
        //         thumbnailElem.style.transform = 'scale(' + scale + ',' + scale + ')';

        //         if (thumbnailTimeLabel) {
        //             thumbnailTimeLabel.textContent = displayUTCTimeCodes ? self.player.formatUTC(mouseTime) : self.player.convertToTimeCode(mouseTime);
        //         }
        //     });
        // }
    };

    var changeBitrateListbyTrack = function () {
        destroyMenu(bitrateListMenu, bitrateListBtn, menuHandlersList.bitrate, 'bitrate');
        if (!isNaN($scope.streamInfo['video'].representationIndex)) {
            createBitrateSwitchMenu('video');
        }
        if (!isNaN($scope.streamInfo['audio'].representationIndex)) {
            createBitrateSwitchMenu('audio');
        }
    };

    return {
        initialize: initialize,
        setDuration: setDuration,
        setTime: setTime,
        destroyAllMenus: destroyAllMenus,
        changeBitrateListbyTrack: changeBitrateListbyTrack,
        removeMenu: removeMenu,

        show: function () {
            videoController.classList.remove('hide');
        },

        hide: function () {
            videoController.classList.add('hide');
        },

        disable: function () {
            videoController.classList.add('disable');
        },

        enable: function () {
            videoController.classList.remove('disable');
        },

        forceQualitySwitch: function (value) {
            forceQuality = value;
        },

        resetSelectionMenus: function () {
            if (menuHandlersList.bitrate) {
                bitrateListBtn.removeEventListener('click', menuHandlersList.bitrate);
            }
            if (menuHandlersList.track) {
                trackSwitchBtn.removeEventListener('click', menuHandlersList.track);
            }
            if (menuHandlersList.caption) {
                captionBtn.removeEventListener('click', menuHandlersList.caption);
            }
            if (captionMenu) {
                this.removeMenu(captionMenu, captionBtn);
            }
            if (trackSwitchMenu) {
                this.removeMenu(trackSwitchMenu, trackSwitchBtn);
            }
            if (bitrateListMenu) {
                this.removeMenu(bitrateListMenu, bitrateListBtn);
            }
        },

        reset: function () {
            window.removeEventListener('resize', handleMenuPositionOnResize);
            this.resetSelectionMenus();
            menuHandlersList = [];
            seeking = false;
            if (seekbarPlay) {
                seekbarPlay.style.width = '0%';
            }
            if (seekbarBuffer) {
                seekbarBuffer.style.width = '0%';
            }
        },

        destroy: function () {
            this.reset();
            playPauseBtn.removeEventListener('click', onPlayPauseClick);
            muteBtn.removeEventListener('click', onMuteClick);
            fullscreenBtn.removeEventListener('click', onFullscreenClick);
            seekbar.removeEventListener('mousedown', onSeeking);
            volumebar.removeEventListener('input', setVolume);
            // seekbar.removeEventListener('mousemove', onSeekBarMouseMove);
            // seekbar.removeEventListener('touchmove', onSeekBarMouseMove);
            // seekbar.removeEventListener('mouseout', onSeekBarMouseMoveOut);
            // seekbar.removeEventListener('touchcancel', onSeekBarMouseMoveOut);
            // seekbar.removeEventListener('touchend', onSeekBarMouseMoveOut);
            // removePlayerEventsListeners();
            document.removeEventListener('fullscreenchange', onFullScreenChange);
            document.removeEventListener('MSFullscreenChange', onFullScreenChange);
            document.removeEventListener('mozfullscreenchange', onFullScreenChange);
            document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
        },

        onPlayStart: onPlayStart,
        onPlaybackPaused: onPlaybackPaused,
        onPlayTimeUpdate: onPlayTimeUpdate,
        onStreamActivated: onStreamActivated,
        onStreamDeactivated: onStreamDeactivated,
        onStreamTeardownComplete: onStreamTeardownComplete,
        onTracksAdded: onTracksAdded,
        onBufferLevelUpdated: onBufferLevelUpdated

    };

}