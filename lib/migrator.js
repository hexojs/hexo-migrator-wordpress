'use strict';

const TurndownService = require('turndown');
const got = require('got');
const { parse: parseUrl } = require('url');
const { exists, listDir, readFile } = require('hexo-fs');
const parseFeed = require('./feed');
const { slugize } = require('hexo-util');
const { join, parse } = require('path');
const { unescape } = require('querystring');

module.exports = async function(args) {
  const source = args._.shift();
  const { alias } = args;
  let { limit } = args;
  const skipduplicate = typeof args.skipduplicate !== 'undefined';
  const tomd = new TurndownService();
  const { config, log } = this;
  const Post = this.post;
  let untitledPostCounter = 0;
  let errNum = 0;
  let skipNum = 0;
  let input, feed;
  const rExcerpt = /<a id="more"><\/a>/i;
  const postExcerpt = '\n<!-- more -->\n';
  const posts = [];
  let currentPosts = [];

  try {
    if (!source) {
      const help = [
        'Usage: hexo migrate wordpress <source> [--options]',
        '',
        'For more help, you can check the docs: https://github.com/hexojs/hexo-migrator-wordpress/blob/master/README.md'
      ];

      throw help.join('\n');
    }

    if (/^http(s)?:\/\//i.test(source)) {
      input = await got(source, { resolveBodyOnly: true, retry: 0 });
    } else {
      input = await readFile(source);
    }

    log.i('Analyzing %s...', source);

    feed = await parseFeed(input);
  } catch (err) {
    throw new Error(err);
  }

  if (feed) {
    if (typeof limit !== 'number' || limit > feed.items.length || limit <= 0) limit = feed.items.length;
    let postLimit = 0;

    for (const item of feed.items) {
      if (postLimit >= limit) continue;

      const { link, date, id, comment, slug, status, type, tags } = item;
      let { title, content, description } = item;

      const layout = status === 'draft' ? 'draft' : 'post';
      content = tomd.turndown(content).replace(/\r\n/g, '\n');

      if (type !== 'page') {
      // Apply 'limit' option to post only
        postLimit++;

        if (rExcerpt.test(content)) {
          content.replace(rExcerpt, postExcerpt);
        } else if (description) {
          description = tomd.turndown(description).replace(/\r\n/g, '\n');
          content = description + postExcerpt + content;
        }
      }

      if (!title) {
        untitledPostCounter += 1;
        const untitledPostTitle = 'Untitled Post - ' + untitledPostCounter;
        title = untitledPostTitle;
        log.w('Post found but without any titles. Using %s', untitledPostTitle);
      } else {
        log.i('Post found: %s', title);
      }

      const data = {
        title,
        id,
        date,
        content,
        layout,
        tags
      };

      if (type === 'page') data.layout = 'page';
      if (slug) data.slug = slug;
      if (slug && slug.includes('%')) data.slug = unescape(slug);
      if (comment === 'closed') data.comments = false;
      if (tags.length && type === 'post') data.tags = tags;

      if (alias && link) {
        data.alias = parseUrl(link).pathname;
      }

      posts.push(data);
    }
  }

  if (skipduplicate) {
    const postFolder = join(config.source_dir, '_posts');
    const folderExist = await exists(postFolder);
    const files = folderExist ? await listDir(join(config.source_dir, '_posts')) : [];
    currentPosts = files.map(file => slugize(parse(file).name, { transform: 1 }));
  }

  if (posts.length >= 1) {
    for (const post of posts) {
      if (currentPosts.length && skipduplicate) {
        if (currentPosts.includes(slugize(post.title, { transform: 1 }))) {
          skipNum++;
          continue;
        }
      }

      try {
        await Post.create(post);
      } catch (err) {
        log.error(err);
        errNum++;
      }
    }

    const postsNum = posts.length - errNum - skipNum;

    if (untitledPostCounter) {
      log.w('%d posts did not have titles and were prefixed with "Untitled Post".', untitledPostCounter);
    }
    if (postsNum) log.i('%d posts migrated.', postsNum);
    if (errNum) log.error('%d posts failed to migrate.', posts.length);
    if (skipNum) log.i('%d posts skipped.', skipNum);
  }
};

