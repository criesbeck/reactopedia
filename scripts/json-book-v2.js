
'use strict';

(function () {
  
  var bookData = {};
  var templates = {};
  var partials = {};
  
  function setBookData(json, callback) {
    var itemMap = { };
    var typeMap = { };
    
    json.items.forEach(function (item) {
      itemMap[item.name] = item;
      
      var type = item.type || 'misc';
      if (typeMap[type] === undefined) typeMap[type] = [];
      typeMap[type].push(item);
      
      item.title = item.title || makeTitle(item.name);
      item.linkedFrom = [];
      item.linksTo = [];
    });
    
    json.items.sort(function (item1, item2) {
      return item1.title.localeCompare(item2.title);
    });
    
    Object.keys(typeMap).forEach(function(type) {
      typeMap[type].sort(function (item1, item2) {
        return item1.title.localeCompare(item2.title);
      });
    });
      
    var allToolNodes = json.items.filter(function(item) { return itemIs(item, 'tool') });
    var allActivityNodes = json.items.filter(function(item) { return itemIs(item, 'activity') });
    
    var topLinks = json.entryPoints.map(function (name) {
      return itemMap[name];
    });
    
    bookData.itemMap = itemMap;
    bookData.typeMap = typeMap;
    bookData.errors = getBookDataErrors(itemMap); 
    bookData.allActivityNodes = allActivityNodes;
    bookData.allToolNodes = allToolNodes;
    bookData.targetTitle = function () { return makeTitle(this.target); };
    
    bookData.unfiled = [];
    bookData.assets = [];
    makeAllIndexLinks(function() {
      window.onhashchange = setPage;
      setPage();
      if (callback) callback(bookData);
    });
  }
  
  function getByField(x, items, field) {
    for (var i = 0; i < items.length; ++i) {
      var item = items[i];
      if (item[field] == x) {
        return item;
      }
    }
    return null;      
  } 
  
  function getItem(name) {
    var item = bookData.itemMap[name];
    if (item) {
      return item;
    }
    else {
      console.log('No item for ' + name);
      return null;
    }
  }
  
  function itemIs(item, type) {
    return item.type && item.type === type;
  }
  
  function makeTitle(text) {
    if (text) {
      var spaced = text.replace(/[_-]/g, ' ');
      return spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
    }
    else {
      return '';
    }
  }
    
  function arrayString(a) {
    return a.join(', ') || '';
  }
  
  function getRedefined(itemNames) {
    return itemNames.filter(function (name) {
      return itemNames.indexOf(name) !== itemNames.lastIndexOf(name);
    });
  }
      
  function getBookDataErrors(itemMap) {
    var itemNames = Object.keys(itemMap);
    var items = itemNames.map(function (name) { return itemMap[name]; });
    return [
      { 'label': 'Redefinitions',
        'value': arrayString(getRedefined(itemNames))
      }
    ];
  }
  
  function updateDisplay() {
    bookData.subtopics = getNodes(bookData.currentNode.topics);

    fillTemplates(document.body);
      
    window.scroll(0, 0);
    
    if (bookData.currentNode.type === 'page-list') {
      displayPages();
    };
  }
  
  function fillTemplates(elt) {    
    elt.querySelectorAll('[data-template]').forEach(fillTemplate);
  }

  function fillTemplate(elt) {
    var id = elt.getAttribute('id');
    var template = getTemplate(id, elt);
    getTemplates(id, elt);
    var rendered = Mustache.render(templates[id], bookData, partials);
    elt.innerHTML = rendered;
    fillTemplates(elt);
  }
  
  function getTemplate(id, elt) {
    if (!templates[id]) {
      templates[id] = elt.querySelector('script').innerHTML;
    }
    return templates[id];
  }
  
  function getTemplates(id, root) {
    root.querySelectorAll('script').forEach(function (elt, n) {
      if (n === 0) {
        templates[id] = elt.innerHTML;
      }
      else {
        partials[elt.getAttribute('id')] = elt.innerHTML;
      }
    });
  }
  
  function loadBook(url, callback) {
    fetch(url).then(function(response) {
      if (response.ok) {
        return response.json();
      }
    }).then(function (json) {
      setBookData(json, callback);
    }).catch(function (error) {
      var msg = error.message ? error.message : "N/A";
      setBookData({ errors: [{ 'status': msg, 'error': error }] }, callback);
      updateDisplay(); 
    });
  }
  
  function getAllLinks(node) {
    var links = [node];
    var oldLength = 1;
    while ((links = expandLinks(links)).length > oldLength) {
      oldLength = links.length;
    }
    return links;
  }
  
  function expandLinks(nodes) {
    var links = [];
    nodes.forEach(function (node) {
      node.linksTo.forEach(function(link) {
        if (links.indexOf(link) === -1 && nodes.indexOf(link) == -1) {
          links.push(link);
        }
      });
    });
    return nodes.concat(links);
  }
  
  function setPage() {
    var name = location.hash ? location.hash.substr(1) : 'agile-client-toolbox';
    var node = getItem(name) || getItem('not-done');
    bookData.currentNode = node;
    
    if (node.pageHtml) {
      updateDisplay();
    }
    else {
      loadPage(node);
    }
  }
  
  function loadPage(node) {
    processPageFile(node,
     function (data) {
       bookData.currentNode.pageHtml = data;
    }, 
     function () {
       updateDisplay();
    }, 
     function () {
       console.log(node.name + '.html not found');
    });
  }
  
  function addLinksInHtml(source, html) {
    bookData.assets.push(pageUrl(source));
    source.pageHtml = html;
    var frag = document.createRange().createContextualFragment(html);
   return frag.querySelectorAll('a[href^=\\#]').forEach(function(elt) { 
      var key = elt.getAttribute('href').slice(1);
      var dest = bookData.itemMap[key];
      if (dest) {
        addLink(source, dest);
      }
    })
  }
  
  function addLink(source, dest) {
    addNodeLink(source, dest.linkedFrom);
    addNodeLink(dest, source.linksTo);
  }
  
  function addNodeLink(node, lst) {
    if (lst.indexOf(node) === -1) {
      lst.push(node);
    }
    if (lst.length > 1) {
      lst.sort(function(node1, node2) {
        return node1.title.localeCompare(node2.title);
      })
    }
  }
  
  function makeAllIndexLinks(callback) {
    Promise.all(makeIndexPromises()).then(callback);
  }
  
  function makeIndexPromises() {
    return Object.keys(bookData.itemMap).map(function (key) {
      return makeIndexPromise(bookData.itemMap[key]);
    });
  }

  function makeIndexPromise(node) {
    return fetch(pageUrl(node)).then(function(response) {
      if (response.ok) {
        return response.text();
      }
      else {
        bookData.unfiled.push(node.name);
      }
    }).then(function(text) {
      addLinksInHtml(node, text);
    }).catch(function(error) {
      return error;
    });
  }  
  
  // this makes a set of independent asynchronous calls
  // shows file html, notes if none exists
  function displayPages() {
    var nodes = bookData.subtopics || getNodes(Object.keys(bookData.itemMap));
    nodes.forEach(function (node) {
      var elt = document.getElementById('item-' + node.name);
      if (elt) {
        processPageFile(node, 
          function(html) {
            elt.classList.add('file-exists'); 
            elt.querySelector('.item-box').innerHTML = html;
          }, 
          function() { return true; },
          function() { elt.classList.add('file-missing'); }
        );
      }
    });
  }
  
  function getNodes(keys) {
    return keys && keys.map(function(key) {
      return bookData.itemMap[key];
    });
  }
  
  function processPageFile(node, doneCb, alwaysCb, failCb) {
    fetch(pageUrl(node)).then(function(response) {
      if (response.ok) {
        return response.text();
      }
      else {
        failCb();
      }
    }).then(function(text) {
      doneCb(text);
    }).finally(alwaysCb);
  }
  
  function pageUrl(node) {
    return 'pages/' + (node.url || node.name)  + '.html';
  }
  
  // last bit of jQuery but no easy replacement
  $('.navbar-collapse a').click(function(){
    $('.navbar-collapse').collapse('hide');
  });
  
  window.loadBook = loadBook;
  
}());