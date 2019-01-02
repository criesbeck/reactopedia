
const app = new Vue({
  el: '#app',
  data: {
    node: {
      title: 'N/A',
      pageHtml: 'N/A',
      linkedFrom: [],
      linkNodes: [],
    },
  },
});

const bookData = { };

const pageHtml = document.getElementById('pageHtml');

function setBookData(json, callback) {
  const itemMap = {};
  const linkMap = {};
  const items = json.items.map(expandItem);

  items.forEach((item) => {
    if (item.url) {
      linkMap[item.name] = item;
    } else {
      itemMap[item.name] = item;
    }
  });

  items.forEach((item) => {
    item.linkNodes = item.links.map(key => linkMap[key]);
  });

  bookData.itemMap = itemMap;
  bookData.linkMap = linkMap;
  bookData.errors = getBookDataErrors(itemMap);

  bookData.unfiled = [];
  bookData.assets = [];
  makeAllIndexLinks().then(() => {
    window.onhashchange = setPage;
    setPage();
    if (callback) {
      callback(bookData);
    }
  });
}

function expandItem(item) {
  return {
    title: makeTitle(item.name),
    links: [],
    linkedFrom: [],
    linksTo: [],
    ...item,
  };
}

function getItem(name) {
  const item = bookData.itemMap[name] || bookData.linkMap[name];
  if (item) {
    return item;
  }
  console.log(`No item for ${name}`);
  return null;
}

function makeTitle(text) {
  if (text) {
    const spaced = text.replace(/[_-]/g, ' ');
    return spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
  }
  return '';
}

function arrayString(a) {
  return a.join(', ') || '';
}

function getRedefined(itemNames) {
  return itemNames.filter(name => itemNames.indexOf(name) !== itemNames.lastIndexOf(name));
}

function getUndefinedLinks(itemNames) {
  return itemNames.map((name) => {
    const item = bookData.itemMap[name];
    return item.links.filter(link => !bookData.linkMap[link]);
  });
}

function getBookDataErrors(itemMap) {
  const itemNames = Object.keys(itemMap);
  return [
    {
      label: 'Redefinitions',
      value: arrayString(getRedefined(itemNames)),
    },
    {
      label: 'Undefined links',
      value: arrayString(getUndefinedLinks(itemNames)),
    },
  ];
}

function updateDisplay() {
  pageHtml.innerHTML = app.node.pageHtml;
  bookData.subtopics = getNodes(app.node.topics);
  window.scroll(0, 0);
}

async function loadBook(url, callback) {
  try {
    const response = await fetch(url);
    const json = await response.json();
    setBookData(json, callback);
  } catch (error) {
    const status = error.message || 'N/A';
    setBookData({ errors: [{ status, error }] }, callback);
    updateDisplay();
  }
}

function getAllLinks(node) {
  let links = [node];
  let oldLength = 1;
  while ((links = expandLinks(links)).length > oldLength) {
    oldLength = links.length;
  }
  return links;
}

function expandLinks(nodes) {
  const links = [];
  nodes.forEach((node) => {
    node.linksTo.forEach((link) => {
      if (links.indexOf(link) === -1 && nodes.indexOf(link) === -1) {
        links.push(link);
      }
    });
  });
  return nodes.concat(links);
}

function setPage() {
  const name = window.location.hash ? window.location.hash.substr(1) : 'reactopedia';
  const node = getPageNode(name);
  app.node = node;
  if (app.node.pageHtml) {
    updateDisplay();
  } else {
    loadPage();
  }
}

function getPageNode(name) {
  if (name === 'pages') {
    return makePagesNode();
  }
  return getItem(name) || getItem('not-done');
}

function loadPage() {
  if (app.node.url) {
    window.location = app.node.url;
  } else {
    processPageFile(app.node,
      (data) => {
        app.node.pageHtml = data;
      },
      () => {
        updateDisplay();
      },
      () => {
        console.log(`${app.node.name}.html not found`);
      });
  }
}

function addLinksInHtml(source, html) {
  bookData.assets.push(pageUrl(source));
  source.pageHtml = html;
  const frag = document.createRange().createContextualFragment(html);
  return frag.querySelectorAll('a[href^=\\#]').forEach((elt) => {
    const key = elt.getAttribute('href').slice(1);
    const dest = bookData.itemMap[key];
    if (dest) {
      addLink(source, dest);
    }
  });
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
    lst.sort((node1, node2) => node1.title.localeCompare(node2.title));
  }
}

async function makeAllIndexLinks() {
  return Promise.all(makeIndexPromises());
}

function makeIndexPromises() {
  return Object.keys(bookData.itemMap).map(key => makeIndexPromise(bookData.itemMap[key], key));
}

async function makeIndexPromise(node, key) {
  if (node.url) {
    return key;
  }
  try {
    const response = await fetch(pageUrl(node));
    if (!response.ok) {
      throw Error(response.statusText);
    }
    const text = await response.text();
    addLinksInHtml(node, text);
    return key;
  } catch (error) {
    bookData.unfiled.push(node.name);
    return key;
  }
}

function makePagesNode() {
  return {
    name: 'pages',
    title: 'All Pages',
    pageHtml: makeAllPagesHtml(),
    linkedFrom: [],
    linkNodes: [],
  };
}

function makeAllPagesHtml() {
  return Object.keys(bookData.itemMap).sort()
    .map(key => makePageBox(bookData.itemMap[key])).join('');
}

function makePageBox(node) {
  if (node.type === 'error') {
    return '';
  }
  return `<div id="item-${node.name}" class="page-item">
  <h4><a href="#${node.name}">${node.title}</a></h4>
  <div class="page-item-box">${node.pageHtml}</div>
</div>`;
}

function getNodes(keys) {
  return keys && keys.map(key => bookData.itemMap[key]);
}

function processPageFile(node, doneCb, alwaysCb, failCb) {
  fetch(pageUrl(node)).then((response) => {
    if (response.ok) {
      return response.text();
    }
    return failCb();
  }).then((text) => {
    doneCb(text);
  }).finally(alwaysCb);
}

function pageUrl(node) {
  return `pages/${node.url || node.name}.html`;
}


window.loadBook = loadBook;
