# OpenRosa FormSubmissionAPI middleware

[![Build Status](https://travis-ci.org/digidem/openrosa-form-submission-middleware.svg?branch=master)](https://travis-ci.org/digidem/openrosa-form-submission-middleware)

This is based on
[connect-multiparty](https://github.com/andrewrk/connect-multiparty) by
[Andrew Kelley](https://github.com/andrewrk/).

It is [express](http://expressjs.com/) middleware for [multiparty](https://github.com/andrewrk/node-multiparty/) to process OpenRosa form submissions from [ODK Collect](https://opendatakit.org/use/collect/) following the [OpenRosa FormSubmissionAPI spec](https://bitbucket.org/javarosa/javarosa/wiki/FormSubmissionAPI).

The xml form submission is returned as req.body and any attached files are returned as req.files.

Incoming files are stored on disk in the `tmp` folder and must be cleanup up afterwards with something like:

```js
req.files.forEach(function(file) {
    fs.unlink(file.path, function() {});
});
```

## Usage

```js
var openrosa = require('openrosa-form-submission-middleware');
var openrosaMiddleware = openrosa();

app.use('/submission', openrosaMiddleware);

app.post('/submission', function(req, res) {
  console.log(req.body, req.files);
  // don't forget to delete all req.files when done
});
```

## API

### openrosa(options)

Returns express middleware for receiving and processing OpenRosa form submissions.

* `options.maxContentLength` sets the maximum content length of form submissions (defaults to 10Mb)

* `options.secure` will redirect OpenRosa clients like ODK Collect to use https to send a submission (it does this by responding to the initial HEAD request from the client with a 204 with the Location headers set with the https protocol set)

Other options are passed directly on to multiparty.
