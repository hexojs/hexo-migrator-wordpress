'use strict';

const TurndownService = require('turndown');
const got = require('got');
const { parse: parseUrl } = require('url');
const { exists, listDir, readFile, writeFile } = require('hexo-fs');
const parseFeed = require('./feed');
const { slugize } = require('hexo-util');
const { basename, join, parse } = require('path');
const { unescape } = require('querystring');

module.exports = async function(args) {
  const source = args._.shift();
  const { alias } = args;
  let { limit } = args;
  const skipduplicate = Object.prototype.hasOwnProperty.call(args, 'skipduplicate');
  const import_image = Object.prototype.hasOwnProperty.call(args, 'import_image');
  const tomd = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const { config, log } = this;
  const { source_dir, post_asset_folder } = config;
  const Post = this.post;
  let untitledPostCounter = 0;
  let errNum = 0;
  let skipNum = 0;
  let imgNum = 0;
  let input, feed;
  const rExcerpt = /<!--+\s*more\s*--+>/i;
  const postExcerpt = '\n<!-- more -->\n';
  const posts = [];
  const rImg = /!\[.*\]\((.*)\)/g;
  const images = {};
  let currentPosts = [];

  const md = str => {
    return tomd.turndown(str);
  };

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
      const { link, date, id, comment, slug, status, type, tags, image_url, image_meta } = item;
      let { title, content, description } = item;
      const layout = status === 'draft' ? 'draft' : 'post';

      if (type === 'attachment') {
        if (!import_image) continue;

        const metadata = image_meta.filter(({ key }) => key === '_wp_attached_file');
        if (!image_url || metadata.length === 0) {
          log.w('"%s" image not found.', title || 'Untitled');
          continue;
        }

        // Import image only
        if (!/\.(jp(e)?g|png|gif|webp)$/.test(image_url)) continue;

        let [{ value: imagePath }] = metadata;

        if (!imagePath) {
          imagePath = basename(parseUrl(image_url).pathname);
          log.w('Image found but without a valid path. Using %s', imagePath);
        } else {
          log.i('Image found: %s', imagePath);
        }

        if (!post_asset_folder) {
          imagePath = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
        } else {
          imagePath = basename(imagePath);
        }

        try {
          const data = await got(image_url, { responseType: 'buffer', resolveBodyOnly: true, retry: 0 });

          if (!post_asset_folder) {
            await writeFile(join(source_dir, imagePath), data);
          } else {
            const rTitle = new RegExp(title + '/?$');
            const postSlug = basename(parseUrl(link).pathname.replace(rTitle, ''));
            await writeFile(join(source_dir, '_posts', postSlug, imagePath), data);
          }

          images[image_url] = imagePath;
          imgNum++;
        } catch (err) {
          log.e(err);
        }

        continue;
      }

      if (type === 'post' || !type) {
        // Apply 'limit' option to post only
        if (postLimit >= limit) continue;
        postLimit++;

        if (rExcerpt.test(content)) {
          content.replace(rExcerpt, (match, index) => {
            const excerpt = md(content.substring(0, index).trim());
            const more = md(content.substring(index + match.length).trim());

            content = excerpt + postExcerpt + more;
          });
        } else if (description) {
          description = md(description);
          content = description + postExcerpt + content;
        } else {
          content = md(content);
        }
      } else {
        content = md(content);
      }

      if (!title) {
        untitledPostCounter += 1;
        const untitledPostTitle = 'Untitled Post - ' + untitledPostCounter;
        title = untitledPostTitle;
        log.w('Post found but without any titles. Using %s', untitledPostTitle);
      } else {
        log.i('Post found: %s', title);
      }

      if (title.includes('"')) title = title.replace(/"/g, '\\"');

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
    const postFolder = join(source_dir, '_posts');
    const folderExist = await exists(postFolder);
    const files = folderExist ? await listDir(join(source_dir, '_posts')) : [];
    currentPosts = files.map(file => slugize(parse(file).name, { transform: 1 }));
  }

  if (posts.length >= 1) {
    for (const post of posts) {
      const { content } = post;

      if (currentPosts.length && skipduplicate) {
        if (currentPosts.includes(slugize(post.title, { transform: 1 }))) {
          skipNum++;
          continue;
        }
      }

      if (Object.keys(images).length && rImg.test(content)) {
        post.content = content.replace(rImg, (matched, wpImg) => {
          const path = images[wpImg];
          if (path) {
            // Replace only link, not caption
            matched = matched.replace(wpImg + ')', path + ')');
          }

          return matched;
        });
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
    if (imgNum) log.i('%d images migrated.', imgNum);
    if (errNum) log.error('%d posts failed to migrate.', posts.length);
    if (skipNum) log.i('%d posts skipped.', skipNum);
  }
};

