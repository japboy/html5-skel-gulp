'use strict';

/**
 * html5-skel-gulp
 */

var fs = require('fs');
var path = require('path');

var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var coffeelint = require('gulp-coffeelint');
var connect = require('gulp-connect');
var csso = require('gulp-csso');
var data = require('gulp-data');
var del = require('del');
var dotenv = require('dotenv');
var envify = require('envify/custom');
var gulp = require('gulp');
var jade = require('gulp-jade');
var jshint = require('gulp-jshint');
var jsonlint = require('gulp-jsonlint');
var nib = require('nib');
var rename = require('gulp-rename');
var sequence = require('run-sequence');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var stylus = require('gulp-stylus');
var uglify = require('gulp-uglify');

var Q = require('q');

function dir (base) {
  return function () {
    var args = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
    return path.join.apply(this, [].concat([ base ], args));
  }
}

function excl (base) {
  return function () {
    var args = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
    return path.join.apply(this, [].concat([ '!' + base ], args));
  }
}

var src = dir(path.join('.', 'src'));
var exclSrc = excl(path.join('.', 'src'));
var dist = dir(path.join('.', 'dist'));
var exclDist = excl(path.join('.', 'dist'));


gulp.task('clean', function (cb) {
  var targets = [
    dist('*')
  ];
  del(targets, { force: true }, cb);
});


gulp.task('copy', function () {
  var promises = [];
  var dirs = [
    { src: [ src('img', '*'), exclSrc('img', 'sprites') ], dest: dist('img') }
  ];
  dirs.forEach(function (dir, i) {
    var dfr = Q.defer();
    gulp.src(dir.src).pipe(gulp.dest(dir.dest)).on('end', dfr.resolve);
    promises.push(dfr.promise);
  });
  return Q.all(promises);
});


gulp.task('jsonlint', function () {
  return gulp.src(src('**/*.json'))
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
});


gulp.task('coffeelint', function () {
  // FIXME: rc must be RuleConstructor
  var rc = JSON.parse(fs.readFileSync('.coffeelintrc'));
  return gulp.src(src('js', '**/*.coffee'), [ rc ])
    .pipe(coffeelint())
    .pipe(coffeelint.reporter());
});

gulp.task('jshint', function () {
  return gulp.src(src('js', '**/*.js'))
    .pipe(jshint(JSON.parse(fs.readFileSync('.jshintrc'))))
    .pipe(jshint.reporter());
});

gulp.task('browserify', [ 'coffeelint', 'jshint', 'jsonlint' ], function () {
  dotenv._getKeysAndValuesFromEnvFilePath(src('.env'));
  dotenv._setEnvs();

  var options = {
    entries: [ './src/js/main.js' ],
    extensions: [ '.coffee', '.js', '.json' ]
  };
  if ('development' === process.env.NODE_ENV) options.debug = true;

  return browserify(options)
    .transform(envify(process.env))
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dist('js')))
    .pipe(connect.reload());
});


gulp.task('jade', function () {
  return gulp.src(src('**/!(_)*.jade'))
    .pipe(data(function (file, cb) {
      fs.readFile(src('meta.json'), function (err, data) {
        if (err) return cb(err);
        cb(undefined, JSON.parse(data));
      });
    }))
    .pipe(jade({ pretty: true }))
    .pipe(gulp.dest(dist()))
    .pipe(connect.reload());
});


gulp.task('spritesmith', function () {
  var img = Q.defer(), css = Q.defer(), promises = [ img.promise, css.promise ];
  var sprite = gulp.src(src('img', 'sprites', '**/*'))
    .pipe(spritesmith({
      imgName: 'sprite.png',
      cssName: '_sprite.styl',
      imgPath: '../img/sprite.png',
      algorithm: 'binary-tree'
    }));
  sprite.img.pipe(gulp.dest(dist('img'))).on('end', img.resolve);
  sprite.css.pipe(gulp.dest(src('css'))).on('end', css.resolve);
  return Q.all(promises);
});

gulp.task('stylus', [ 'spritesmith' ] function () {
  var options = {
    sourcemap: {
      inline: true,
      sourceRoot: '.'
    },
    use: nib()
  };
  return gulp.src(src('css', 'main.styl'))
    .pipe(stylus(options))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(csso())
    .pipe(sourcemaps.write())
    .pipe(rename('bundle.css'))
    .pipe(gulp.dest(dist('css')))
    .pipe(connect.reload());
});


gulp.task('default', [ 'clean' ], function (cb) {
  sequence([ 'copy', 'browserify', 'jade' ], 'stylus', cb);
});


gulp.task('listen', function () {
  var options = {
    host: '0.0.0.0',
    livereload: true,
    port: 8001,
    root: dist()
  };

  gulp.watch(src('img', '**/*'), [ 'copy' ], { debounceDelay: 1000 });
  gulp.watch([ src('js', '**/*.coffee'), src('js', '**/*.js') ], [ 'browserify' ], { debounceDelay: 1000 });
  gulp.watch([ src('**/*.jade'), src('meta.json') ], [ 'jade' ], { debounceDelay: 1000 });
  gulp.watch(src('css', '**/*.styl'), [ 'stylus' ], { debounceDelay: 1000 });

  connect.server(options);
});
