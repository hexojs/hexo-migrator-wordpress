# hexo-migrator-wordpress

[![Build Status](https://travis-ci.org/hexojs/hexo-migrator-wordpress.svg?branch=master)](https://travis-ci.org/hexojs/hexo-migrator-wordpress)
[![NPM version](https://badge.fury.io/js/hexo-migrator-wordpress.svg)](https://www.npmjs.com/package/hexo-migrator-wordpress)

Migrate your blog from WordPress to [Hexo].

## Install

In your blog folder, add this npm dependencie to your project:

``` bash
$ npm install hexo-migrator-wordpress --save
```

## Usage

Export your WordPress in "Tools" → "Export" → "All Content" in your dashboard.

Execute the following command after installed. `source` is the file path or URL of WordPress export file.

``` bash
$ hexo migrate wordpress <source> [--options]
```

- **alias**: Populates the `alias` setting in the front-matter, for use with the [hexo-generator-alias](http://github.com/hexojs/hexo-generator-alias) module. This is useful for generating redirects.
- **limit**: Maximum number of posts to import from the input file. All posts are imported by default.
  * Example:
  ``` bash
  $ hexo migrate wordpress /path/export.xml --limit 3
  ```
  * This doesn't apply to pages, all pages will be imported.
- **skipduplicate**: Skip posts with similar title as existing ones.
  * If the input contains a post titled 'Foo Bar' and there is an existing post named 'Foo-Bar.md', then that post will not be migrated.
  * The comparison is case-insensitive; a post titled 'FOO BAR' will be skipped if 'foo-bar.md' exists.
  * Without this option (default), this plugin will continue to migrate that post and create a post named 'Foo-Bar-1.md'
- **import_image**: Download all image attachments from your Wordpress.
  * Downloaded images will be saved based on the original directories.
    * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` => `source/2020/07/image.jpg` => `http://yourhexo.com/2020/07/image.jpg`.
    * Image embed link will be automatically replaced with a new path.
      * Example: `![title](http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg)` => `![title](/2020/07/image.jpg)`
  * If [`post_asset_folder`](https://hexo.io/docs/asset-folders#Post-Asset-Folder) is enabled, images will be saved according to their associated post.
      * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` is associated with `http://yourwordpress.com/2020/07/04/foo-post/` post.
      * `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` => `source/_posts/foo-post/image.jpg` => `http://yourhexo.com/2020/07/04/foo-post/image.jpg`.
    * Image embed link will be automatically replaced with a new path.
      * Example: `![title](http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg)` => `![title](image.jpg)`
  * Limited to JPEG, PNG, GIF and WebP images only.
  * Disabled by default.

[Hexo]: http://hexo.io/
