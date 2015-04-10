var request = require('request');
var fs = require('fs');
var rx = require('rx');
var path = require('path');
var _ = require('lodash');
var request = require('./request-rx');
var secrets = require('./secrets');

var baseUrl = secrets.baseUrl;
var token = secrets.token;
var channel = secrets.channel;

var sample_texts = fs.readdirSync(path.join(__dirname, 'sample_texts'));

var samples = _.reduce(sample_texts, function(acc, x) {
  acc[x] = fs.readFileSync(path.join(__dirname, 'sample_texts', x), 'utf8');
  return acc;
}, {});

// console.log(JSON.stringify(samples));

var sendAMessage = function(channelToPost, msg) {
  return request.post({url: baseUrl + '/api/chat.postMessage', form: {
    token: token,
    channel: channelToPost,
    text: msg,
  }});
};

rx.Observable.fromArray(_.keys(samples))
  .concatMap(function(language) { return sendAMessage(channel, samples[language]); })
  .subscribe();
