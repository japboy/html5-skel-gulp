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
var gulp = require('gulp');
var jade = require('gulp-jade');
var jshint = require('gulp-jshint');
var nib = require('nib');
var rimraf = require('rimraf');
var sequence = require('run-sequence');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var stylus = require('gulp-stylus');
var uglify = require('gulp-uglify');


function dir (base) {
  return function () {
    var args = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
    return path.join.apply(this, [].concat([ base ], args));
  }
}

var src = dir(path.join('.', 'src'));
var dist = dir(path.join('.', 'dist'));


gulp.task('clean', function (callback) {
  rimraf(dist(), callback);
});


gulp.task('coffeelint', function () {
  // FIXME: rc must be RuleConstructor
  var rc = JSON.parse(fs.readFileSync('.coffeelintrc'));
  gulp.src(src('js', '**/*.coffee'), [ rc ])
    .pipe(coffeelint())
    .pipe(coffeelint.reporter());
});

gulp.task('jshint', function () {
  gulp.src(src('js', '**/*.js'))
    .pipe(jshint())
    .pipe(jshint.reporter());
});

gulp.task('browserify', [ 'coffeelint', 'jshint' ], function () {
  var options = {
    entries: [ './src/js/main.js' ],
    extensions: [ '.coffee', '.js', '.json' ],
    debug: true
  };
  return browserify(options)
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
  var options = {
    locals: JSON.parse(fs.readFileSync(src('meta.json'))),
    pretty: true
  };
  gulp.src(src('**/!(_)*.jade'))
    .pipe(jade(options))
    .pipe(gulp.dest(dist()))
    .pipe(connect.reload());
});


gulp.task('stylus', function () {
  var options = {
    sourcemap: {
      inline: true,
      sourceRoot: '.'
    },
    use: nib()
  };
  gulp.src(src('css', '**/!(_)*.styl'))
    .pipe(stylus(options))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(csso())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dist('css')))
    .pipe(connect.reload());
});



gulp.task('default', [ 'clean' ], function () {
  sequence([ 'browserify' ], [ 'jade' ], [ 'stylus' ]);
});


gulp.task('listen', [ 'default' ], function () {
  var options = {
    host: '0.0.0.0',
    livereload: true,
    port: 8001,
    root: dist()
  };

  gulp.watch(src('js', '**/*'), [ 'browserify' ]);
  gulp.watch(src('**/*.jade'), [ 'jade' ]);
  gulp.watch(src('css', '**/*.styl'), [ 'stylus' ]);

  connect.server(options);
});
