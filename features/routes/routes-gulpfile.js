'use strict';

module.exports = function routes($allonsy, $gulp) {

  var through = require('through2'),
      fs = require('fs'),
      path = require('path'),
      sourcemaps = require('gulp-sourcemaps'),
      uglify = require('gulp-uglify'),
      rename = require('gulp-rename'),
      extend = require('extend'),
      src = $allonsy.globPatterns('controllers/*-route.js');

  $gulp.task('routes', function(done) {

    var files = [],
        routes = [],
        types = ['enter', 'exit'],
        routeTemplate = fs.readFileSync(path.resolve(__dirname, 'routes-route-template.js'), 'utf-8'),
        controllerTemplate = /{{controller}}([^]+){{\/controller}}/.exec(routeTemplate)[1];

    $gulp
      .src(src)
      .pipe(through.obj(function(file, encoding, throughDone) {
        files.push(file);

        throughDone();
      }, function(throughDone) {
        var transform = this;

        files.forEach(function(file) {
          var routesConfig = require(file.path),
              inModules = file.path.indexOf('node_modules') > -1,
              fileSplitted = file.path.split(path.sep),
              fileName = fileSplitted.pop(),
              fileFeature = fileSplitted.pop() ? fileSplitted.pop() : null,
              fileUrl = '/public/' + fileFeature + '/' + fileName,
              template = routeTemplate,
              controllers = [];

          delete require.cache[file.path];

          if (inModules) {
            fileSplitted.pop();
            fileSplitted.pop();
          }

          file.path = path.resolve(fileSplitted.join(path.sep) + '/' + fileFeature + '/' + fileName);


          if (!Array.isArray(routesConfig)) {
            routesConfig = [routesConfig];
          }

          routesConfig.forEach(function(routeConfig) {
            if (!fileFeature || (!routeConfig.enter && !routeConfig.exit)) {
              return;
            }

            routeConfig.priority = typeof routeConfig.priority != 'number' ? 50 : routeConfig.priority;
            routeConfig.priority = routeConfig.priority == 'min' ? 0 : routeConfig.priority;
            routeConfig.priority = routeConfig.priority == 'max' ? 100 : routeConfig.priority;

            var urls = routeConfig.urls || routeConfig.url;
            if (typeof urls == 'string') {
              urls = '\'' + urls + '\'';
            }
            else {
              urls = '[\'' + urls.join('\', \'') + '\']';
            }

            for (var i = 0; i < types.length; i++) {
              var type = types[i],
                  funcString = '';

              if (typeof routeConfig[type] == 'function') {
                funcString = routeConfig[type].toString();
              }
              else if (Array.isArray(routeConfig[type])) {
                var funcArray = extend(true, [], routeConfig[type]);
                funcString = funcArray.pop().toString();

                if (funcArray.length) {
                  funcString = '[\'' + funcArray.join('\', \'') + '\', ' + funcString + ']';
                }
              }

              if (routeConfig[type]) {
                controllers.push(controllerTemplate
                  .replace('{{type}}', type)
                  .replace('{{urls}}', urls)
                  .replace('{{file}}', fileUrl)
                  .replace('{{func}}', funcString)
                );
              }
            }

            routes.push({
              urls: urls,
              priority: routeConfig.priority,
              file: fileUrl,
              path: file.path,
              enter: !!routeConfig.enter,
              exit: !!routeConfig.exit
            });

            file.contents = new Buffer(template.replace(/({{controller}}[^]+{{\/controller}})/, controllers.join('')));
          });

          transform.push(file);
        });

        throughDone();
      }))
      .pipe($gulp.dist())
      .pipe(sourcemaps.init())
      .pipe(uglify())
      .pipe(rename({
        extname: '.min.js'
      }))
      .pipe(sourcemaps.write('./'))
      .pipe($gulp.dist())
      .on('end', function() {

        var routesFile = null;

        $gulp
          .src(path.resolve(__dirname, 'routes-routes-template.js'))
          .pipe(through.obj(function(file, encoding, throughDone) {
            routesFile = file;

            throughDone();
          }, function(throughDone) {
            if (!routesFile) {
              return throughDone();
            }

            var transform = this;

            routesFile.path = routesFile.path.replace('routes-routes-template.js', 'routes.js');

            routesFile.contents = new Buffer(routesFile.contents.toString().replace('{{routes}}', '[\n' +
              routes
                .sort(function(a, b) {
                  if (a.priority > b.priority) {
                    return -1;
                  }

                  if (a.priority < b.priority) {
                    return 1;
                  }

                  return 0;
                })
                .map(function(route) {
                  return '        {urls: ' + route.urls + ', file: \'' + route.file + '\', enter: ' + route.enter + ', exit: ' + route.exit + '}';
                })
                .join(',\n') +
              '\n      ]'
            ));

            transform.push(routesFile);

            throughDone();

            transform.emit('end');
          }))
          .pipe($gulp.dist('routes'))
          .pipe(sourcemaps.init())
          .pipe(uglify())
          .pipe(rename({
            extname: '.min.js'
          }))
          .pipe(sourcemaps.write('./'))
          .pipe($gulp.dist('routes'))
          .on('end', done);
      });
  });

  return {
    tasks: 'routes',
    watch: src
  };
};
