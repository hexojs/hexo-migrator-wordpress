# WordPress migrator

[![Build Status](https://travis-ci.org/hexojs/hexo-migrator-wordpress.svg?branch=master)](https://travis-ci.org/hexojs/hexo-migrator-wordpress)
[![NPM version](https://badge.fury.io/js/hexo-migrator-wordpress.svg)](https://www.npmjs.com/package/hexo-migrator-wordpress)

Migrate your blog from WordPress to [Hexo].

## Install

In your blog folder, add this npm dependencie to your project :
 
``` bash
$ npm install hexo-migrator-wordpress --save
```

## Usage

Export your WordPress in "Tools" → "Export" → "WordPress" in your dashboard.

Execute the following command after installed. `source` is the file path or URL of WordPress export file.

``` bash
$ hexo migrate wordpress <source>
```

[Hexo]: http://zespia.tw/hexo
