'use strict';

require('chai').should();
const should = require('chai').should();
const { basename, dirname, extname, join } = require('path');
const { parse: parseUrl } = require('url');
const { exists, listDir, readFile, rmdir, unlink, writeFile } = require('hexo-fs');
const Hexo = require('hexo');
const hexo = new Hexo(process.cwd(), { silent: true });
const m = require('../lib/migrator.js').bind(hexo);
const parseFeed = require('../lib/feed');
const { spy } = require('sinon');
const log = spy(hexo.log);
const TurndownService = require('turndown');
const tomd = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const { deepMerge, escapeHTML, slugize } = require('hexo-util');
const { parse: fm } = require('hexo-front-matter');
const defaultCfg = deepMerge({}, hexo.config);

const filterPost = ({ type }) => {
  return type === 'post';
};

const md = str => {
  return tomd.turndown(str);
};

// Extract a post's content excluding front-matter
// https://github.com/hexojs/hexo-front-matter
const parsePost = (post, newline = false) => {
  const { _content: content } = fm(post);
  if (newline === false) return content.replace(/\r?\n/g, '');
  return content.trim();
};

describe('migrator', function() {
  this.timeout(5000);

  before(() => hexo.init());

  beforeEach(() => { hexo.config = deepMerge({}, defaultCfg); });

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

    const files = await listDir(hexo.source_dir);
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
    const title = 'lorem "ipsum"';
    const xml = `<rss><channel><title>test</title>
    <item><title>${title}</title><content:encoded><![CDATA[foobar]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const post = await readFile(join(hexo.source_dir, '_posts', slugize(title) + '.md'));
    const { title: postTitle } = fm(post);
    postTitle.should.eql(title);

    await unlink(path);
  });

  // #76
  it('handle title with escaped character', async () => {
    const title = 'lorem & "ipsum"';
    const xml = `<rss><channel><title>test</title>
    <item><title><![CDATA[${escapeHTML(title)}]]></title>
    <content:encoded><![CDATA[foo]]></content:encoded>
    <wp:post_name><![CDATA[${slugize(title)}]]></wp:post_name>
    </item>
    </channel></rss>`;
    const path = join(__dirname, 'post.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const post = await readFile(join(hexo.source_dir, '_posts', slugize(title) + '.md'));
    const { title: postTitle } = fm(post);
    postTitle.should.eql(title);

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

  it('tags', async () => {
    const title = 'foo';
    const postTags = ['lorem', 'ipsum', 'dolor'];
    const [lorem, ipsum, dolor] = postTags;
    const xml = `<rss><channel><title>test</title>
    <item><title>${title}</title><content:encoded><![CDATA[foobar]]></content:encoded>
    <category domain="category" nicename="uncategorized"><![CDATA[Uncategorized]]></category>
    <category domain="post_tag" nicename="${lorem}"><![CDATA[${lorem}]]></category>
    <category domain="post_tag" nicename="${ipsum}"><![CDATA[${ipsum}]]></category>
    <category domain="post_tag" nicename="${dolor}"><![CDATA[${dolor}]]></category>
    </item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
    const { tags } = fm(post);

    tags.should.have.members(postTags);

    await unlink(path);
  });

  describe('category', async () => {
    const title = 'foo';

    it('nested categories - two-level', async () => {
      const postCats = ['lorem', 'ipsum', 'dolor'];
      const [lorem, ipsum, dolor] = postCats;
      const xml = `<rss><channel><title>test</title>
      <wp:category>
      <wp:cat_name>${ipsum}</wp:cat_name>
      <wp:category_parent>${lorem}</wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${lorem}</wp:cat_name>
      <wp:category_parent></wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${dolor}</wp:cat_name>
      <wp:category_parent></wp:category_parent>
      </wp:category>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      <category domain="category">${lorem}</category>
      <category domain="category">${ipsum}</category>
      <category domain="category">${dolor}</category>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([['lorem', 'ipsum'], ['dolor']]);

      await unlink(path);
    });

    it('nested categories - three-level', async () => {
      const postCats = ['lorem', 'ipsum', 'dolor', 'foo', 'bar'];
      const [lorem, ipsum, dolor, foo, bar] = postCats;
      const xml = `<rss><channel><title>test</title>
      <wp:category>
      <wp:cat_name>${dolor}</wp:cat_name>
      <wp:category_parent>${ipsum}</wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${ipsum}</wp:cat_name>
      <wp:category_parent>${lorem}</wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${lorem}</wp:cat_name>
      <wp:category_parent></wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${bar}</wp:cat_name>
      <wp:category_parent>${foo}</wp:category_parent>
      </wp:category>
      <wp:category>
      <wp:cat_name>${foo}</wp:cat_name>
      <wp:category_parent></wp:category_parent>
      </wp:category>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      <category domain="category">${lorem}</category>
      <category domain="category">${ipsum}</category>
      <category domain="category">${dolor}</category>
      <category domain="category">${foo}</category>
      <category domain="category">${bar}</category>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([['lorem', 'ipsum', 'dolor'], ['foo', 'bar']]);

      await unlink(path);
    });

    // #36
    it('non-nested categories', async () => {
      const postCats = ['lorem', 'ipsum', 'dolor'];
      const postCatsArray = postCats.map(cat => [cat]);
      const [lorem, ipsum, dolor] = postCats;
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      <category domain="category">${lorem}</category>
      <category domain="category">${ipsum}</category>
      <category domain="category">${dolor}</category>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members(postCatsArray);

      await unlink(path);
    });

    it('avoid "uncategorized" category', async () => {
      const postCats = ['lorem', 'ipsum', 'dolor'];
      const postCatsArray = postCats.map(cat => [cat]);
      const [lorem, ipsum, dolor] = postCats;
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      <category domain="category" nicename="uncategorized">Uncategorized</category>
      <category domain="category">${lorem}</category>
      <category domain="category">${ipsum}</category>
      <category domain="category">${dolor}</category>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members(postCatsArray);

      await unlink(path);
    });

    it('default-category argument', async () => {
      const defaultCat = 'bar';
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'default-category': defaultCat });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([[defaultCat]]);

      await unlink(path);
    });

    it('default_category config (default)', async () => {
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([[hexo.config.default_category]]);

      await unlink(path);
    });

    it('default_category config (custom)', async () => {
      hexo.config.default_category = 'bar';
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([[hexo.config.default_category]]);

      await unlink(path);
    });

    it('argument should override config', async () => {
      hexo.config.default_category = 'bar';
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><content:encoded>foobar</content:encoded>
      </item>
      </channel></rss>`;
      const path = join(__dirname, 'excerpt.xml');
      await writeFile(path, xml);
      const category = 'baz';
      await m({ _: [path], 'default-category': category });

      const post = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
      const { categories } = fm(post);
      categories.should.have.deep.members([[category]]);

      await unlink(path);
    });
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
    const output = parsePost(rendered);

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
    const output = parsePost(rendered);

    output.should.eql(content.replace(/<!-- wp:more -->/g, ''));

    await unlink(path);
  });

  it('retain paragraph', async () => {
    const title = 'baz';
    const content = 'lorem\n\nipsum\n\ndolor';
    const xml = `<rss><channel><title>test</title>
    <item><title>${title}</title><content:encoded><![CDATA[${content}]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path], 'paragraph-fix': true });

    const rendered = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
    const output = parsePost(rendered, true);

    output.should.eql(content);

    await unlink(path);
  });

  it('retain paragraph - disable', async () => {
    const title = 'baz';
    const content = 'lorem\n\nipsum\n\ndolor';
    const xml = `<rss><channel><title>test</title>
    <item><title>${title}</title><content:encoded><![CDATA[${content}]]></content:encoded></item>
    </channel></rss>`;
    const path = join(__dirname, 'excerpt.xml');
    await writeFile(path, xml);
    await m({ _: [path] });

    const rendered = await readFile(join(hexo.source_dir, '_posts', title + '.md'));
    const output = parsePost(rendered);

    output.should.eql(content.replace(/\n{2}/g, ' '));

    await unlink(path);
  });

  describe('import image', () => {
    const postTitle = 'foo';
    const imgTitle = 'A Big Image';
    const imgSlug = 'image';
    const wp = (imageUrl = '', imagePath = '', content = '') => {
      return `<rss><channel><title>test</title>
      <item><title>${postTitle}</title><wp:post_type>post</wp:post_type>
      <content:encoded><![CDATA[${content}]]></content:encoded></item>
      <item><title>${imgTitle}</title>
      <link>http://localhost/wp/2020/07/07/${postTitle}/${imgSlug}/</link>
      <wp:post_name>${imgSlug}</wp:post_name>
      <wp:post_type>attachment</wp:post_type>
      <wp:attachment_url>${imageUrl}</wp:attachment_url>
      <wp:postmeta>
      <wp:meta_key>_wp_attached_file</wp:meta_key><wp:meta_value>${imagePath}</wp:meta_value>
      </wp:postmeta>
      <wp:postmeta>
      <wp:meta_key>bar</wp:meta_key><wp:meta_value>bar</wp:meta_value>
      </wp:postmeta>
      </item>
      </channel></rss>`;
    };

    it('default', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const imagePath = '2020/07/hexo.png';
      const imgEmbed = `<img src="${imageUrl}" alt="${imageUrl}" />`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      log.i.calledWith('Image found: %s', imagePath).should.eql(true);

      const { items } = await parseFeed(xml);
      const imgNum = items.filter(({type}) => type === 'attachment').length;
      const { lastCall } = log.i;
      lastCall.calledWith('%d images migrated.', imgNum).should.eql(true);

      const image = await readFile(join(hexo.source_dir, imagePath), { encoding: 'binary' });
      const header = Buffer.from(image, 'binary').toString('hex').substring(0, 14);

      // PNG
      header.should.eql('89504e470a1a0a');

      // original link should be replaced with local image
      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered);

      output.should.eql(md(imgEmbed).replace(imageUrl + ')', '/' + imagePath + ')'));

      await unlink(path);
    });

    it('should avoid non-post assets', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const imagePath = '2020/07/hexo.png';
      const imgEmbed = `<p><img src="${imageUrl}" alt="${imageUrl}" /></p><p><img src="http://foo.com/bar.jpg" /></p>`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered, true);

      output.should.eql(md(imgEmbed).replace(imageUrl + ')', '/' + imagePath + ')'));

      await unlink(path);
    });

    // #102
    it('content with ()', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const imagePath = '2020/07/hexo.png';
      const imgEmbed = `<p><img src="${imageUrl}" alt="${imageUrl}" />Lorem ipsum dolor sit amet (consectetur adipiscing elit)</p>`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered, true);

      output.should.eql(md(imgEmbed).replace(imageUrl + ')', '/' + imagePath + ')'));

      await unlink(path);
    });

    it('resized image', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.jpg';
      const imagePath = '2020/07/hexo.jpg';
      const resizeImg = dirname(imageUrl) + '/' + basename(imageUrl, extname(imageUrl)) + '-100x90' + extname(imageUrl);
      const resizePath = dirname(imagePath) + '/' + basename(resizeImg);
      const imgEmbed = `<img src="${resizeImg}" alt="${imageUrl}" />`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      // Original size
      const image = await readFile(join(hexo.source_dir, imagePath), { encoding: 'binary' });
      const header = Buffer.from(image, 'binary').toString('hex').substring(0, 6);

      // JPEG
      header.should.eql('ffd8ff');

      // Resized
      const tinyImg = await readFile(join(hexo.source_dir, resizePath), { encoding: 'binary' });
      const tinyHeader = Buffer.from(tinyImg, 'binary').toString('hex').substring(0, 6);
      tinyHeader.should.eql('ffd8ff');

      // original link should be replaced with local resized image
      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered);

      output.should.eql(md(imgEmbed).replace(resizeImg + ')', '/' + resizePath + ')'));

      await unlink(path);
    });

    it('resized image - original only', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.jpg';
      const imagePath = '2020/07/hexo.jpg';
      const resizeImg = dirname(imageUrl) + '/' + basename(imageUrl, extname(imageUrl)) + '-100x90' + extname(imageUrl);
      const imgEmbed = `<img src="${resizeImg}" alt="${imageUrl}" />`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': 'original' });

      const resizePath = join(dirname(imagePath), basename(resizeImg));
      const fileExist = await exists(join(hexo.source_dir, resizePath));
      fileExist.should.eql(false);

      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered);

      output.should.eql(md(imgEmbed).replace(resizeImg + ')', '/' + imagePath + ')'));

      await unlink(path);
    });

    it('post_asset_folder', async () => {
      hexo.config.post_asset_folder = true;
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const imagePath = '2020/07/hexo.png';
      const imageFile = basename(imagePath);
      const imgEmbed = `<img src="${imageUrl}" alt="${imageUrl}" />`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const imgExist = await exists(join(hexo.source_dir, '_posts', postTitle, imageFile));
      imgExist.should.eql(true);

      // original link should be replaced with local image
      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered);

      output.should.eql(md(imgEmbed).replace(imageUrl + ')', imageFile + ')'));

      await unlink(path);
    });

    it('post_asset_folder - resized image', async () => {
      hexo.config.post_asset_folder = true;
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.jpg';
      const imagePath = '2020/07/hexo.jpg';
      const resizeImg = dirname(imageUrl) + '/' + basename(imageUrl, extname(imageUrl)) + '-100x90' + extname(imageUrl);
      const imageFile = basename(resizeImg);
      const imgEmbed = `<img src="${resizeImg}" alt="${imageUrl}" />`;
      const xml = wp(imageUrl, imagePath, imgEmbed);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const imgExist = await exists(join(hexo.source_dir, '_posts', postTitle, imageFile));
      imgExist.should.eql(true);

      // original link should be replaced with local image
      const rendered = await readFile(join(hexo.source_dir, '_posts', postTitle + '.md'));
      const output = parsePost(rendered);

      output.should.eql(md(imgEmbed).replace(resizeImg + ')', imageFile + ')'));

      await unlink(path);
    });

    it('disabled', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const imagePath = '2020/07/image.png';
      const xml = wp(imageUrl, imagePath);
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path] });

      const imgExist = await exists(join(hexo.source_dir, imagePath));
      imgExist.should.eql(false);

      await unlink(path);
    });

    it('invalid xml', async () => {
      const title = 'foo';
      const xml = `<rss><channel><title>test</title>
      <item><title>${title}</title><wp:post_type>attachment</wp:post_type></item>
      </channel></rss>`;
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      log.w.calledWith('"%s" image not found.', title).should.eql(true);

      await unlink(path);
    });

    it('no image link', async () => {
      const xml = wp('');
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      log.w.calledWith('"%s" image not found.', imgTitle).should.eql(true);

      await unlink(path);
    });

    it('no image path', async () => {
      const imageUrl = 'https://raw.githubusercontent.com/hexojs/hexo-migrator-wordpress/master/test/fixtures/hexo.png';
      const filename = basename(parseUrl(imageUrl).pathname);
      const xml = wp(imageUrl, '');
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      log.w.calledWith('Image found but without a valid path. Using %s', filename).should.eql(true);

      const image = await readFile(join(hexo.source_dir, filename), { encoding: 'binary' });
      const header = Buffer.from(image, 'binary').toString('hex').substring(0, 14);

      header.should.eql('89504e470a1a0a');

      await unlink(path);
    });

    it('invalid image link', async () => {
      const imageUrl = 'http://does.not.exist/image.jpeg';
      const xml = wp(imageUrl, 'image.png');
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const [[{ name: errMsg }]] = log.e.args;
      errMsg.should.eql('RequestError');

      await unlink(path);
    });

    it('non-image', async () => {
      const imageUrl = 'https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js';
      const imagePath = '2020/07/image.png';
      const xml = wp(imageUrl, 'image.png');
      const path = join(__dirname, 'image.xml');
      await writeFile(path, xml);
      await m({ _: [path], 'import-image': true });

      const imageExist = await exists(join(hexo.source_dir, imagePath));
      imageExist.should.eql(false);

      await unlink(path);
    });
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
