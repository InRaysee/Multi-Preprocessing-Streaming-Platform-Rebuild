'use strict';

var capturer = function () {

    const videoElement = document.getElementById('camera');
    const audioSelect = document.querySelector('select#audioCapture');
    const videoSelect = document.querySelector('select#videoCapture');
    const selectors = [audioSelect, videoSelect];
    var windowStream = null;

    const gotDevices = function (deviceInfos) {
        // Handles being called several times to update labels. Preserve values.
        const values = selectors.map(select => select.value);
        selectors.forEach(select => {
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
        });
        for (let i = 0; i !== deviceInfos.length; ++i) {
            const deviceInfo = deviceInfos[i];
            const option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'audioinput') {
                option.text = deviceInfo.label || `microphone ${audioSelect.length + 1}`;
                audioSelect.appendChild(option);
            } else if (deviceInfo.kind === 'videoinput') {
                option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
                videoSelect.appendChild(option);
            } else {
                console.log('Some other kind of source/device: ', deviceInfo);
            }
        }
        selectors.forEach((select, selectorIndex) => {
            if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
                select.value = values[selectorIndex];
            }
        });
    };

    const gotStream = function (stream) {
        windowStream = stream; // make stream available to console
        videoElement.srcObject = stream;
        // Refresh button list in case labels have become available
        return navigator.mediaDevices.enumerateDevices();
    };

    const handleError = function (error) {
        console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
    };

    const start = function () {
        if (windowStream) {
            windowStream.getTracks().forEach(track => {
                track.stop();
            });
        }
        const audioSource = audioSelect.value;
        const videoSource = videoSelect.value;
        const constraints = {
            audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
            video: {deviceId: videoSource ? {exact: videoSource} : undefined}
        };
        navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
    };

    const destroy = function () {
        selectors.forEach(select => {
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
        });
        if (windowStream) {
            windowStream.getTracks().forEach(track => {
                track.stop();
            });
            windowStream = null;
        }
        videoElement.srcObject = null;
        audioSelect.onchange = null;
        videoSelect.onchange = null;
    };

    audioSelect.onchange = start;
    videoSelect.onchange = start;

    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
    start();

    return {
        destroy: destroy
    };

};



