/* global hexo */
'use strict';

hexo.extend.migrator.register('wordpress', require('./lib/migrator'));
