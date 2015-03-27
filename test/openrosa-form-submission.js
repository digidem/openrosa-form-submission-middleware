/*global describe it*/
process.env.NODE_ENV = 'test'

var express = require('express')
var formSubmission = require('..')
var request = require('supertest')
var fs = require('fs')
var path = require('path')

require('should')

var app = express()

app.use(formSubmission())

app.use(function (req, res) {
  res.end(JSON.stringify(req.body))
})

describe('formSubmissionMiddleware()', function () {
  it('should ignore GET', function (done) {
    request(app)
      .get('/')
      .set('X-OpenRosa-Version', '1.0')
      .field('user', 'Tobi')
      .expect(200, '', done)
  })

  it('should respond to HEAD with 204 and X-OpenRosa-Version header', function (done) {
    request(app)
      .head('/')
      .set('X-OpenRosa-Version', '1.0')
      .field('user', 'Tobi')
      .expect('X-OpenRosa-Version', '1.0')
      .expect(204, '', done)
  })

  describe('with multipart/form-data', function () {
    var xmlFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'xml_submission_file.xml'))

    it('should return xml_submission_file as the form body', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        req.body.should.eql(xmlFixture.toString())
        req.files.length.should.eql(0)
        res.end('{}')
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .expect(200, '{}', done)
    })

    it('should handle multiple file attachments', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        req.body.should.eql(xmlFixture.toString())
        req.files[0].path.should.endWith('.jpg')
        req.files.length.should.eql(2)
        res.end(req.files[1].originalFilename)
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .attach('photo', path.join(__dirname, 'fixtures', 'image.jpg'))
        .attach('photo', path.join(__dirname, 'fixtures', 'image2.jpg'))
        .expect(200, 'image2.jpg', done)
    })

    it('should support multiple files of the same name', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        req.files.should.have.length(2)
        req.files[0].constructor.name.should.equal('Object')
        req.files[1].constructor.name.should.equal('Object')
        res.end()
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .attach('text', new Buffer('some text here'), { filename: 'foo.txt' })
        .attach('text', new Buffer('some more text stuff'), { filename: 'bar.txt' })
        .expect(200, done)
    })

    it('should support nested files', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        req.files.should.have.length(2)
        req.files[0].originalFilename.should.equal('foo.txt')
        req.files[1].originalFilename.should.equal('bar.txt')
        res.end()
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .attach('docs[foo]', new Buffer('some text here'), { filename: 'foo.txt' })
        .attach('docs[bar]', new Buffer('some more text stuff'), { filename: 'bar.txt' })
        .expect(200, done)
    })

    it('should next(err) on multipart failure', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end('whoop')
      })

      app.use(function (err, req, res, next) {
        err.message.should.equal('Expected alphabetic character, received 61')
        res.statusCode = err.status
        res.end('bad request')
      })

      var test = request(app).post('/').set('X-OpenRosa-Version', '1.0')
      test.set('Content-Type', 'multipart/form-data; boundary=foo')
      test.write('--foo\r\n')
      test.write('Content-filename="foo.txt"\r\n')
      test.write('\r\n')
      test.write('some text here')
      test.write('Content-Disposition: form-data; name="text"; filename="bar.txt"\r\n')
      test.write('\r\n')
      test.write('some more text stuff')
      test.write('\r\n--foo--')
      test.expect(400, 'bad request', done)
    })

    it('should not hang request on failure', function (done) {
      var app = express()
      var buf = new Buffer(1024 * 10)

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end('whoop')
      })

      app.use(function (err, req, res, next) {
        err.message.should.equal('Expected alphabetic character, received 61')
        res.statusCode = err.status
        res.end('bad request')
      })

      buf.fill('.')

      var test = request(app).post('/').set('X-OpenRosa-Version', '1.0')
      test.set('Content-Type', 'multipart/form-data; boundary=foo')
      test.write('--foo\r\n')
      test.write('Content-filename="foo.txt"\r\n')
      test.write('\r\n')
      test.write('some text here')
      test.write('Content-Disposition: form-data; name="text"; filename="bar.txt"\r\n')
      test.write('\r\n')
      test.write('some more text stuff')
      test.write('\r\n--foo--')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(400, 'bad request', done)
    })

    it('should default req.files to []', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end(JSON.stringify(req.files))
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .expect(200, '[]', done)
    })

    it('should return 400 on maxFilesSize exceeded', function (done) {
      var app = express()

      var exp = 9
      app.use(formSubmission({ maxFilesSize: Math.pow(2, exp) }))

      app.use(function (req, res) {
        res.end(JSON.stringify(req.files))
      })

      var str = 'x'
      for (var i = 0; i < exp + 1; i += 1) {
        str += str
      }

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .field('user[name]', 'Tobi')
        .attach('text', new Buffer(str), { filename: 'foo.txt' })
        .expect(400, done)
    })

    it('should return next(err) if no xml_submission_file is included', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end('whoop')
      })

      app.use(function (err, req, res, next) {
        err.message.should.equal('No xml submission file included in request')
        res.statusCode = err.status
        res.end('bad request')
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .attach('photo', path.join(__dirname, 'fixtures', 'image.jpg'))
        .expect(400, 'bad request', done)
    })

    it('should reject requests without X-OpenRosa-Version header', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end('whoop')
      })

      request(app)
        .post('/')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .expect(400, done)
    })

    it('should include "X-OpenRosa-Accept-Content-Length" header in response', function (done) {
      var app = express()

      app.use(formSubmission())

      app.use(function (req, res) {
        res.end('whoop')
      })

      request(app)
        .post('/')
        .set('X-OpenRosa-Version', '1.0')
        .expect('X-OpenRosa-Accept-Content-Length', '10485760')
        .attach('xml_submission_file', xmlFixture, { filename: 'foo.xml' })
        .expect(200, done)
    })

  })
})
