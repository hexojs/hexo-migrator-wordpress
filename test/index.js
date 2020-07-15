'use strict';

require('chai').should();
const should = require('chai').should();
const { join } = require('path');
const { exists, listDir, readFile, rmdir, unlink, writeFile } = require('hexo-fs');
const Hexo = require('hexo');
const hexo = new Hexo(process.cwd(), { silent: true });
const m = require('../lib/migrator.js').bind(hexo);
const parseFeed = require('../lib/feed');
const { spy } = require('sinon');
const log = spy(hexo.log);

const filterPost = ({ type }) => {
  return type === 'post';
};

describe('migrator', function() {
  this.timeout(5000);

  before(() => hexo.init());

  afterEach(async () => {
    const exist = await exists(hexo.source_dir);
    if (exist) await rmdir(hexo.source_dir);
  });

  it('default - file', async () => {
    await m({ _: [join(__dirname, 'fixtures/wordpress.xml')] });
    const exist = await exists(join(hexo.source_dir, '_posts', 'hello-world.md'));

    exist.should.eql(true);
  });

  it('default - should import all posts/pages', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    await m({ _: [path] });

    const files = await listDir(join(hexo.source_dir));
    const feed = await readFile(path);
    const expected = await parseFeed(feed);

    files.length.should.eql(expected.items.length);
  });

  it('default - logging', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    await m({ _: [path] });

    const input = await readFile(path);
    const { items } = await parseFeed(input);

    const { firstCall, lastCall } = log.i;

    firstCall.calledWith('Analyzing %s...', path).should.eql(true);
    lastCall.calledWith('%d posts migrated.', items.length).should.eql(true);
  });

  it('default - logging (untitled post)', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    await m({ _: [path] });

    log.w.calledWith('%d posts did not have titles and were prefixed with "Untitled Post".', 1).should.eql(true);
  });

  it('default - url', async () => {
    await m({ _: ['https://github.com/hexojs/hexo-migrator-wordpress/raw/master/test/fixtures/wordpress.xml'] });
    const exist = await exists(join(hexo.source_dir, '_posts', 'dove-comprare-200-mg-celebrex.md'));

    exist.should.eql(true);
  });

  it('handle title with double quotes', async () => {
    const { slugize } = require('hexo-util');

    const title = 'lorem "ipsum"';
    const xml = `<rss><channel><title>test</title>
    <item><title>${title}</title><content:encoded><![CDATA[foobar]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const post = await readFile(join(hexo.source_dir, '_posts', slugize(title) + '.md'));
    post.includes('title: ' + title).should.eql(true);

    await unlink(path);
  });

  // #12
  it('decode percent-encoding in slug', async () => {
    const { unescape } = require('querystring');
    const path = join(__dirname, 'fixtures/wordpress.xml');
    await m({ _: [path] });

    const input = await readFile(path);
    const { items } = await parseFeed(input);
    const [percentEncoded] = items.filter(({ slug }) => slug.includes('%'));
    const posts = await listDir(join(hexo.source_dir, '_posts'));

    posts.includes(unescape(percentEncoded.slug) + '.md').should.eql(true);
  });

  it('excerpt', async () => {
    const content = 'foo<!-- more -->bar';
    const xml = `<rss><channel><title>test</title>
    <item><title>baz</title><content:encoded><![CDATA[${content}]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const rendered = await readFile(join(hexo.source_dir, '_posts', 'baz.md'));
    const rFrontMatter = /^([\s\S]+?)\n(-{3,}|;{3,})(?:$|\n([\s\S]*)$)/;
    const output = rendered.match(rFrontMatter)[3].replace(/\r?\n|\r/g, '');

    output.should.eql(content);

    await unlink(path);
  });

  it('excerpt - wp:more', async () => {
    const content = 'foo<!-- wp:more --><!-- more --><!-- wp:more -->bar';
    const xml = `<rss><channel><title>test</title>
    <item><title>baz</title><content:encoded><![CDATA[${content}]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const rendered = await readFile(join(hexo.source_dir, '_posts', 'baz.md'));
    const rFrontMatter = /^([\s\S]+?)\n(-{3,}|;{3,})(?:$|\n([\s\S]*)$)/;
    const output = rendered.match(rFrontMatter)[3].replace(/\r?\n|\r/g, '');

    output.should.eql(content.replace(/<!-- wp:more -->/g, ''));

    await unlink(path);
  });

  it('import image', async () => {
    const imageUrl = 'https://raw.githubusercontent.com/hexojs/logo/master/hexo-logo-avatar.png';
    const imagePath = '2020/07/image.png';
    const xml = `<rss><channel><title>test</title>
    <item><title>image</title><wp:post_type>attachment</wp:post_type>
    <wp:attachment_url>${imageUrl}</wp:attachment_url>
    <wp:postmeta>
    <wp:meta_key>_wp_attached_file</wp:meta_key><wp:meta_value>${imagePath}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
    <wp:meta_key>bar</wp:meta_key><wp:meta_value>bar</wp:meta_value>
    </wp:postmeta>
    </item>
    </channel></rss>`;
    const path = join(__dirname, 'image.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const files = await listDir(join(hexo.source_dir));
    files.length.should.eql(1);

    const image = await readFile(join(hexo.source_dir, imagePath), { encoding: 'binary' });
    const header = Buffer.from(image, 'binary').toString('hex').substring(0, 14);

    // PNG
    header.should.eql('89504e470a1a0a');

    await unlink(path);
  });

  it('no argument', async () => {
    try {
      await m({ _: [''] });
      should.fail();
    } catch (err) {
      err.message.split('\n')[0].should.eql('Usage: hexo migrate wordpress <source> [--options]');
    }
  });

  it('invalid url', async () => {
    const url = 'http://does.not.exist/';
    try {
      await m({ _: [url] });
      should.fail();
    } catch (err) {
      err.message.includes('RequestError:').should.eql(true);
    }
  });

  it('invalid path', async () => {
    const path = 'does/not/exist';
    try {
      await m({ _: [path] });
      should.fail();
    } catch (err) {
      err.message.includes('Error: ENOENT: no such file or directory').should.eql(true);
    }
  });

  it('option - limit', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const limit = 2;
    await m({ _: [path], limit });

    const posts = await listDir(join(hexo.source_dir, '_posts'));
    posts.length.should.eql(limit);
  });

  it('option - limit should not apply to page', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const limit = 3;
    await m({ _: [path], limit });

    const files = await listDir(join(hexo.source_dir));
    const pages = files.filter(file => !file.startsWith('_posts'));

    const feed = await readFile(path);
    const expected = await parseFeed(feed);
    const expectedPages = expected.items.filter(({ type }) => type === 'page');

    pages.length.should.eql(expectedPages.length);
  });

  it('option - invalid limit', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const limit = 9000;
    await m({ _: [path], limit });
    const posts = await listDir(hexo.source_dir);
    const input = await readFile(path);
    const expected = await parseFeed(input);

    posts.length.should.eql(expected.items.length);
  });

  it('option - skipduplicate', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const postDir = join(hexo.source_dir, '_posts');
    await writeFile(join(postDir, 'hello-world.md'), 'foo');
    await m({ _: [path], skipduplicate: true });

    const posts = await listDir(postDir);
    const input = await readFile(path);
    const expected = await parseFeed(input);
    const expectedPosts = expected.items.filter(filterPost);

    posts.length.should.eql(expectedPosts.length);
  });

  it('option - skipduplicate (no existing post)', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const postDir = join(hexo.source_dir, '_posts');
    await m({ _: [path], skipduplicate: true });

    const posts = await listDir(postDir);
    const input = await readFile(path);
    const expected = await parseFeed(input);
    const expectedPosts = expected.items.filter(filterPost);

    posts.length.should.eql(expectedPosts.length);
  });

  it('option - skipduplicate disabled', async () => {
    const path = join(__dirname, 'fixtures/wordpress.xml');
    const postDir = join(hexo.source_dir, '_posts');
    await writeFile(join(postDir, 'hello-world.md'), 'foo');
    await m({ _: [path] });

    const posts = await listDir(postDir);
    const input = await readFile(path);
    const expected = await parseFeed(input);
    const expectedPosts = expected.items.filter(filterPost);

    posts.length.should.not.eql(expectedPosts.length);
    (posts.length > expectedPosts.length).should.eql(true);
  });
});
