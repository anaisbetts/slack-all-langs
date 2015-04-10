'use strict';

var rx = require('rx');
var request = require('request');
var fs = require('fs');

var wrapMethodInRx = function wrapMethodInRx(method) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return rx.Observable.create(function (subj) {
      // Push the callback as the last parameter
      args.push(function (err, resp, body) {
        if (err) {
          subj.onError(err);
          return;
        }

        if (resp.statusCode >= 400) {
          subj.onError(new Error('Request failed: ' + resp.statusCode + '\n' + body));
          return;
        }

        subj.onNext({ response: resp, body: body });
        subj.onCompleted();
      });

      try {
        method.apply(undefined, args);
      } catch (e) {
        subj.onError(e);
      }

      return rx.Disposable.empty;
    });
  };
};

var requestRx = wrapMethodInRx(request);
requestRx.get = wrapMethodInRx(request.get);
requestRx.post = wrapMethodInRx(request.post);
requestRx.patch = wrapMethodInRx(request.patch);
requestRx.put = wrapMethodInRx(request.put);
requestRx.del = wrapMethodInRx(request.del);

requestRx.pipe = function (url, stream) {
  return rx.Observable.create(function (subj) {
    try {
      request.get(url).on('response', function (resp) {
        if (resp.statusCode > 399) subj.onError(new Error('Failed request: ' + resp.statusCode));
      }).on('error', function (err) {
        return subj.onError(err);
      }).on('end', function () {
        subj.onNext(true);subj.onCompleted();
      }).pipe(stream);
    } catch (e) {
      subj.onError(e);
    }
  });
};

var isHttpUrl = function isHttpUrl(pathOrUrl) {
  return pathOrUrl.match(/^http/i);
};

// Public: Fetches a file or URL, then returns its content as an Observable
//
// pathOrUrl - Either a file path or an HTTP URL
//
// Returns: An Observable which will yield a single value and complete, the contents
// of the given path or URL.
requestRx.fetchFileOrUrl = function (pathOrUrl) {
  if (!isHttpUrl(pathOrUrl)) {
    try {
      return rx.Observable['return'](fs.readFileSync(pathOrUrl, { encoding: 'utf8' }));
    } catch (e) {
      return rx.Observable['throw'](e);
    }
  }

  return requestRx(pathOrUrl).map(function (x) {
    return x.body;
  });
};

// Private: Opens a file or URL, then returns a Readable Stream as an Observable
//
// pathOrUrl - Either a file path or an HTTP URL
//
// Returns: An Observable which will yield a single value and complete, which will
// be a Readable Stream that can be used with `pipe` or `read` / `readSync`
requestRx.streamFileOrUrl = function (pathOrUrl) {
  if (!isHttpUrl(pathOrUrl)) {
    return rx.Observable.create(function (subj) {
      var s = fs.createReadStream(pathOrUrl);

      s.on('open', function () {
        subj.onNext(s);
        subj.onCompleted();
      });

      s.on('error', function (err) {
        return subj.onError(err);
      });

      return rx.Disposable.empty;
    });
  }

  return rx.Observable.create(function (subj) {
    var rq = null;
    try {
      rq = request(pathOrUrl);
    } catch (e) {
      subj.onError(e);
      return rx.Disposable.empty;
    }

    rq.on('response', function (resp) {
      subj.onNext(resp);
      subj.onCompleted();
    });

    rq.on('error', function (err) {
      return subj.onError(err);
    });
    return rx.Disposable.empty;
  });
};

module.exports = requestRx;
