# hexo-migrator-wordpress

[![Build Status](https://github.com/hexojs/hexo-migrator-wordpress/workflows/Tester/badge.svg)](https://github.com/hexojs/hexo-migrator-wordpress/actions?query=workflow%3ATester)
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
- **import-image**: Download all image attachments from your Wordpress.
  * Downloaded images will be saved based on the original directories.
    * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` => `source/2020/07/image.jpg` => `http://yourhexo.com/2020/07/image.jpg`.
    * Image embed link will be automatically replaced with a new path.
      * Example: `![title](http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg)` => `![title](/2020/07/image.jpg)`
  * If [`post_asset_folder`](https://hexo.io/docs/asset-folders#Post-Asset-Folder) is enabled before migration, images will be saved according to their associated post.
      * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` is associated with `http://yourwordpress.com/2020/07/04/foo-post/` post.
      * `http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg` => `source/_posts/foo-post/image.jpg` => `http://yourhexo.com/2020/07/04/foo-post/image.jpg`.
    * Image embed link will be automatically replaced with a new path.
      * Example: `![title](http://yourwordpress.com/wp-content/uploads/2020/07/image.jpg)` => `![title](image.jpg)`
    * Note that the images are only valid when viewing individual post, not in index page. If you prefer to have them viewable on the index page too and you are using hexo-renderer-marked 3.1.0+, enables the [`postAsset:`](https://github.com/hexojs/hexo-renderer-marked#options) option.
  * Limited to JPEG, PNG, GIF and WebP images only.
  * This also applies to resized images.
    * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image-500x300.jpg` => `source/2020/07/image-500x300.jpg` => `http://yourhexo.com/2020/07/image-500x300.jpg`.
    * Compatible with `post_asset_folder`: `http://yourwordpress.com/wp-content/uploads/2020/07/image-500x300.jpg` => `source/_posts/foo-post/image-500x300.jpg` => `http://yourhexo.com/2020/07/04/foo-post/image-500x300.jpg`.
  * Usage: `$ hexo migrate wordpress /path/export.xml --import_image`
  * **original**: Download original image attachments only.
    * Resized image embed will be replaced with original-sized image.
    * Example: `http://yourwordpress.com/wp-content/uploads/2020/07/image-500x300.jpg` => `source/2020/07/image.jpg` => `http://yourhexo.com/2020/07/image.jpg`.
    * Usage: `$ hexo migrate wordpress /path/export.xml --import_image original`
- **paragraph-fix**: If you used Wordpress [classic editor](https://wordpress.org/plugins/classic-editor/) to write posts, you may find imported posts do not have the original paragraphs. Use this option to restore the paragraphs.
- **default-category**: Set a default category for posts without any category.
  * Usage: `$ hexo migrate wordpress /path/export.xml --default-category 'unknown'`
  * Defaults to the value set in user configuration:
  ``` yml
  # _config.yml
  default_category: uncategorized
  ```

[Hexo]: http://hexo.io/
