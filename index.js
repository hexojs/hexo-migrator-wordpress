'use strict';

/* global hexo */

const xml2js = require('xml2js');
const async = require('async');
const TurndownService = require('turndown');
const request = require('request');
const file = require('fs');

const turndownService = new TurndownService();

const captialize = function(str) {
  return str[0].toUpperCase() + str.substring(1);
};

function replaceTwoBrace(str) {
  str = str.replace(/{{/g, '{ {');
  return str;
}

hexo.extend.migrator.register('wordpress', (args, callback) => {
  const source = args._.shift();

  if (!source) {
    const help = [
      'Usage: hexo migrate wordpress <source>',
      '',
      'For more help, you can check the docs: http://hexo.io/docs/migration.html'
    ];

    console.log(help.join('\n'));
    return callback();
  }

  const log = hexo.log;
  const post = hexo.post;

  log.i('Analyzing %s...', source);

  async.waterfall([
    function(next) {
      // URL regular expression from: http://blog.mattheworiordan.com/post/13174566389/url-regular-expression-for-links-with-or-without-the
      if (source.match(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\w]*))?)/)) {
        request(source, (err, res, body) => {
          if (err) throw err;
          if (res.statusCode === 200) next(null, body);
        });
      } else {
        file.readFile(source, next);
      }
    },
    function(content, next) {
      xml2js.parseString(content, next);
    },
    function(xml, next) {
      let count = 0;

      async.each(xml.rss.channel[0].item, (item, next) => {
        if (!item['wp:post_type']) {
          return next();
        }

        const title = item.title[0].replace(/"/g, '\\"');
        const id = item['wp:post_id'][0];
        const date = item['wp:post_date'][0];
        const slug = item['wp:post_name'][0];
        let content = item['content:encoded'][0];
        const comment = item['wp:comment_status'][0];
        const status = item['wp:status'][0];
        const type = item['wp:post_type'][0];
        const categories = [];
        const tags = [];

        if (!title && !slug) return next();
        if (type !== 'post' && type !== 'page') return next();
        if (typeof content !== 'string') content = '';
        content = replaceTwoBrace(content);
        content = turndownService.turndown(content).replace(/\r\n/g, '\n');
        count++;

        if (item.category) {
          item.category.forEach((category, next) => {
            const name = category._;

            switch (category.$.domain) {
              case 'category':
                categories.push(name);
                break;

              case 'post_tag':
                tags.push(name);
                break;
            }
          });
        }

        const data = {
          title: title || slug,
          url: +id + '.html',
          id: +id,
          date: date,
          content: content,
          layout: status === 'draft' ? 'draft' : 'post'
        };

        if (type === 'page') data.layout = 'page';
        if (slug) data.slug = slug;
        if (comment === 'closed') data.comments = false;
        if (categories.length && type === 'post') data.categories = categories;
        if (tags.length && type === 'post') data.tags = tags;

        log.i('%s found: %s', captialize(type), title);
        post.create(data, next);
      }, err => {
        if (err) return next(err);

        log.i('%d posts migrated.', count);
      });
    }
  ], callback);
});
