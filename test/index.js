'use strict';

require('chai').should();
const should = require('chai').should();
const { join } = require('path');
const { exists, listDir, readFile, rmdir, writeFile } = require('hexo-fs');
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

  it.skip('default - url', async () => {
    await m({ _: ['https://github.com/hexojs/hexo-migrator-wordpress/raw/master/test/fixtures/wordpress.xml'] });
    const exist = await exists(join(hexo.source_dir, '_posts', 'dove-comprare-200-mg-celebrex.md'));

    exist.should.eql(true);
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
