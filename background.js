/// <reference path="chrome_extensions.js" />
/// <reference path="jquery-1.7.1.min.js" />
/// <reference path="myhttp.js" />
// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('logged_in');
var canvasContext = canvas.getContext('2d');
var pollIntervalMin = 1;  // 1 minutes
var pollIntervalMax = 5;  // 5 hour
var requestTimeout = 1000 * 5;  // 5 seconds
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime;
var requestTimerId;

//Return Base url of Freelancer
function getFreelancerUrl() {
    return "https://www.freelancer.com/";
}
// Identifier used to debug the possibility of multiple instances of the
// extension making requests on behalf of a single user.

function getFreelancerFeedUrl() {
    // "zx" is a Freelancer query parameter that is expected to contain a random
    // string and may be ignored/stripped.
    return "https://www.freelancer.com/ajax/notify/live-feed/pre-populated.php";
}

function isFreelancerUrl(url) {
    // Return whether the URL starts with the Freelancer prefix.
    return url.indexOf(getFreelancerUrl()) == 0;
}

// A "loading" animation displayed while we wait for the first response from
// Freelancer. This animates the badge text with a dot that cycles from left to
// right.
function LoadingAnimation() {
    this.timerId_ = 0;
    this.maxCount_ = 8;  // Total number of states in animation
    this.current_ = 0;  // Current state
    this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function () {
    var text = "";
    for (var i = 0; i < this.maxDot_; i++) {
        text += (i == this.current_) ? "." : " ";
    }
    if (this.current_ >= this.maxDot_)
        text += "";

    chrome.browserAction.setBadgeText({ text: text });
    this.current_++;
    if (this.current_ == this.maxCount_)
        this.current_ = 0;
}

LoadingAnimation.prototype.start = function () {
    if (this.timerId_)
        return;

    var self = this;
    this.timerId_ = window.setInterval(function () {
        self.paintFrame();
    }, 100);
}

LoadingAnimation.prototype.stop = function () {
    if (!this.timerId_)
        return;

    window.clearInterval(this.timerId_);
    this.timerId_ = 0;
}

function updateIcon() {
    if (!localStorage.hasOwnProperty('unreadCount')) {
        chrome.browserAction.setIcon({ path: "freelancer_not_logged_in.png" });
        chrome.browserAction.setBadgeBackgroundColor({ color: [190, 190, 190, 230] });
        chrome.browserAction.setBadgeText({ text: "?" });
    } else {
        chrome.browserAction.setIcon({ path: "freelancer_logged_in.png" });
        chrome.browserAction.setBadgeBackgroundColor({ color: [208, 0, 24, 255] });
        chrome.browserAction.setBadgeText({
            text: localStorage.unreadCount != "0" ? localStorage.unreadCount : ""
        });
    }
}

function scheduleRequest() {
    console.log('scheduleRequest');
    var randomness = Math.random() * 2;
    var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
    var multiplier = Math.max(randomness * exponent, 1);
    var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);
    delay = Math.round(delay);
    console.log('Scheduling for: ' + delay);

    if (oldChromeVersion) {
        if (requestTimerId) {
            window.clearTimeout(requestTimerId);
        }
        requestTimerId = window.setTimeout(onAlarm, delay * 60 * 1000);
    } else {
        console.log('Creating alarm');
        // Use a repeating alarm so that it fires again if there was a problem
        // setting the next alarm.
        chrome.alarms.create('refresh', { periodInMinutes: delay });
    }
}

// ajax stuff
function startRequest(params) {
    // Schedule request immediately. We want to be sure to reschedule, even in the
    // case where the extension process shuts down while this request is
    // outstanding.
    if (params && params.scheduleRequest) scheduleRequest();

    function stopLoadingAnimation() {
        if (params && params.showLoadingAnimation) loadingAnimation.stop();
    }

    if (params && params.showLoadingAnimation)
        loadingAnimation.start();

    //getInboxCount(
    getFLFeedCount(
      function (list10feed) {
          stopLoadingAnimation();
          updateUnreadCount(countNewFeed(list10feed));
      },
      function () {
          stopLoadingAnimation();
          delete localStorage.unreadCount;
          updateIcon();
      }
    );
}
function countNewFeed(listnewfeed) {
    var countnew = 0;
    var oldfed = localStorage.listIdOldFeed;
    var val2;
    for (var i = listnewfeed.length - 1; i >= 0 ; i--) {
        val2 = listnewfeed[i];
        var id = val2.id + 'i';
        var idupdate = i + 'i';
        if (oldfed == '' || localStorage.listIdOldFeed.indexOf(id) == -1)//new id
        {
            countnew++;
            localStorage.listIdOldFeed += id;
            //create notify
            chrome.notifications.create(id, {
                type: "basic",
                title: val2.title,
                message: '<[' + val2.jobString + ']>' + val2.appended_descr,
                iconUrl: "icon_128.png"
            }, function (idreturn) {
                console.log(idreturn + ' created');
                setTimeout(NofifyClear, 180000, idreturn);
            });
        }

    }
    return countnew;
}
function NofifyClear(idnotify) {
    localStorage.listIdOldFeed = localStorage.listIdOldFeed.replace(idnotify, '');
    chrome.notifications.clear(idnotify, function (cleared) {
        console.log(idnotify + ' cleared ' + ' = ' + cleared);
    });
}
function getFLFeedCount(onSuccess, onError) {
    //var blkstr = [];

    //chrome.cookies.getAll({ url: "https://www.freelancer.com" }, function (cookies) {

    //    $.each(cookies, function (key2, val2) {
    //        var str = val2.name + "=" + val2.value;
    //        blkstr.push(str);
    //    });
    //})

    //cookie: blkstr.join(", "),
    //request get json
    myhttp.Getajax({
        url: getFreelancerFeedUrl(),
        success: function (d) {
            localStorage.requestFailureCount = 0;
            onSuccess(d);
        },
        error: function (d) {
            ++localStorage.requestFailureCount;
            onError();
        }
    })

    //------------------
}

function updateUnreadCount(count) {
    var changed = localStorage.unreadCount != count;
    localStorage.unreadCount = count;
    updateIcon();
    if (changed)
        animateFlip();
}


function ease(x) {
    return (1 - Math.sin(Math.PI / 2 + x * Math.PI)) / 2;
}

function animateFlip() {
    rotation += 1 / animationFrames;
    drawIconAtRotation();

    if (rotation <= 1) {
        setTimeout(animateFlip, animationSpeed);
    } else {
        rotation = 0;
        updateIcon();
    }
}

function drawIconAtRotation() {
    canvasContext.save();
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.translate(
        Math.ceil(canvas.width / 2),
        Math.ceil(canvas.height / 2));
    canvasContext.rotate(2 * Math.PI * ease(rotation));
    canvasContext.drawImage(loggedInImage,
        -Math.ceil(canvas.width / 2),
        -Math.ceil(canvas.height / 2));
    canvasContext.restore();

    chrome.browserAction.setIcon({
        imageData: canvasContext.getImageData(0, 0,
            canvas.width, canvas.height)
    });
}

function goToInbox() {
    chrome.tabs.create({ url: 'https://www.freelancer.com/u/autoclick.html' });
}

function onInit() {
    console.log('onInit');
    localStorage.requestFailureCount = 0;  // used for exponential backoff
    localStorage.listIdOldFeed = '';  // 
    startRequest({ scheduleRequest: true, showLoadingAnimation: true });
    if (!oldChromeVersion) {
        // TODO(mpcomplete): We should be able to remove this now, but leaving it
        // for a little while just to be sure the refresh alarm is working nicely.
        chrome.alarms.create('watchdog', { periodInMinutes: 5 });
    }

}

function onAlarm(alarm) {
    console.log('Got alarm', alarm);
    // |alarm| can be undefined because onAlarm also gets called from
    // window.setTimeout on old chrome versions.
    if (alarm && alarm.name == 'watchdog') {
        onWatchdog();
    } else {
        startRequest({ scheduleRequest: true, showLoadingAnimation: false });
    }
}

function onWatchdog() {
    chrome.alarms.get('refresh', function (alarm) {
        if (alarm) {
            console.log('Refresh alarm exists. Yay.');
        } else {
            console.log('Refresh alarm doesn\'t exist!? ' +
                        'Refreshing now and rescheduling.');
            startRequest({ scheduleRequest: true, showLoadingAnimation: false });
        }
    });
}

if (oldChromeVersion) {
    updateIcon();
    onInit();
} else {
    chrome.runtime.onInstalled.addListener(onInit);
    chrome.alarms.onAlarm.addListener(onAlarm);
    chrome.notifications.onClicked.addListener(function (notificationId) {
        chrome.tabs.create({
            url: "https://www.freelancer.com/projects/" + notificationId.replace('i', '') + ".html"
        })
    });
}

var filters = {
    // TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
    // part. See crbug.com/140238.
    url: [{ urlContains: getFreelancerUrl().replace(/^https?\:\/\//, '') }]
};

function onNavigate(details) {
    if (details.url && isFreelancerUrl(details.url)) {
        console.log('Recognized Freelancer navigation to: ' + details.url + '.' +
                    'Refreshing count...');
        startRequest({ scheduleRequest: false, showLoadingAnimation: false });
    }
}
if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
    chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(
        onNavigate, filters);
} else {
    chrome.tabs.onUpdated.addListener(function (_, details) {
        onNavigate(details);
    });
}

chrome.browserAction.onClicked.addListener(goToInbox);

if (chrome.runtime && chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(function () {
        console.log('Starting browser... updating icon.');
        startRequest({ scheduleRequest: false, showLoadingAnimation: false });
        updateIcon();
    });
} else {
    // This hack is needed because Chrome 22 does not persist browserAction icon
    // state, and also doesn't expose onStartup. So the icon always starts out in
    // wrong state. We don't actually use onStartup except as a clue that we're
    // in a version of Chrome that has this problem.
    chrome.windows.onCreated.addListener(function () {
        console.log('Window created... updating icon.');
        startRequest({ scheduleRequest: false, showLoadingAnimation: false });
        updateIcon();
    });
}
