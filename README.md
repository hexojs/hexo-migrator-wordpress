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

Export your WordPress in "Tools" → "Export" → "WordPress" in your dashboard.

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

[Hexo]: http://hexo.io/
