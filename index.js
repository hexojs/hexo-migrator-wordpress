var xml2js = require('xml2js'),
  async = require('async'),
  tomd = require('to-markdown').toMarkdown,
  request = require('request'),
  file = require('fs');

var captialize = function(str){
  return str[0].toUpperCase() + str.substring(1);
};

hexo.extend.migrator.register('wordpress', function(args, callback){
  var source = args._.shift();

  if (!source){
    var help = [
      'Usage: hexo migrate wordpress <source>',
      '',
      'For more help, you can check the docs: http://hexo.io/docs/migration.html'
    ];

    console.log(help.join('\n'));
    return callback();
  }

  var log = hexo.log,
    post = hexo.post;

  log.i('Analyzing %s...', source);

  async.waterfall([
    function(next){
      // URL regular expression from: http://blog.mattheworiordan.com/post/13174566389/url-regular-expression-for-links-with-or-without-the
      if (source.match(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[.\!\/\\w]*))?)/)){
        request(source, function(err, res, body){
          if (err) throw err;
          if (res.statusCode == 200) next(null, body);
        });
      } else {
        file.readFile(source, next);
      }
    },
    function(content, next){
      xml2js.parseString(content, next);
    },
    function(xml, next){
      var count = 0;

      async.each(xml.rss.channel[0].item, function(item, next){
        if (!item['wp:post_type']){
          return next();
        }

        var title = item.title[0],
          id = item['wp:post_id'][0],
          date = item['wp:post_date'][0],
          slug = item['wp:post_name'][0],
          content = item['content:encoded'][0],
          comment = item['wp:comment_status'][0],
          status = item['wp:status'][0],
          type = item['wp:post_type'][0],
          categories = [],
          tags = [];

        if (!title && !slug) return next();
        if (type !== 'post' && type !== 'page') return next();
        if (typeof content !== 'string') content = '';

        content = tomd(content).replace(/\r\n/g, '\n');
        count++;

        if (item.category){
          item.category.forEach(function(category, next){
            var name = category._;

            switch (category.$.domain){
              case 'category':
                categories.push(name);
                break;

              case 'post_tag':
                tags.push(name);
                break;
            }
          });
        }

        var data = {
          title: title || slug,
          id: +id,
          date: date,
          content: content,
          layout: status === 'draft' ? 'draft' : 'post',
        };

        if (type === 'page') data.layout = 'page';
        if (slug) data.slug = slug;
        if (comment === 'closed') data.comment = false;
        if (categories.length && type === 'post') data.categories = categories;
        if (tags.length && type === 'post') data.tags = tags;

        log.i('%s found: %s', captialize(type), title);
        post.create(data, next);
      }, function(err){
        if (err) return next(err);

        log.i('%d posts migrated.', count);
      });
    }
  ], callback);
});
