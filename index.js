const root = document.documentElement;
const viewer = document.getElementById('viewer');
const filePicker = document.getElementById('filePicker');
const zip = new window.JSZip();

let jumpTo = [];
const assets = [];
const starred = new Set();

let index = -1;
let url = null;
let nextImage = null;
let timer = null;

const viewable = f => /.(jpe?g)$/i.test(f.name);

async function load(item, img, url) {
  let p = Promise.resolve(item);
  if (typeof item.file === 'function') {
    p = new Promise(resolve => {
      item.file(resolve);
    });
  }

  return p.then(file => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
    url = URL.createObjectURL(file);
    img.src = url;
    img.alt = item.fullPath || item.webkitRelativePath;
    return { img, item };
  });
}

async function show() {
  const item = assets[index];
  if (!item) {
    console.log('no item', index);
    return;
  }
  document.title = `${index + 1} / ${assets.length} images`;
  let img = nextImage;
  if (!img) {
    const { img: _img } = await load(item, new Image(), url);
    img = _img;
  }
  viewer.innerHTML = '';
  viewer.dataset.filename = img.alt;
  if (starred.has(item)) viewer.dataset.filename += ' ⭐️';
  viewer.appendChild(img);
}

function toggleFullScreen() {
  if (!document.mozFullScreen && !document.webkitFullScreen) {
    if (document.body.mozRequestFullScreen) {
      document.body.mozRequestFullScreen();
    } else {
      document.body.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else {
      document.webkitCancelFullScreen();
    }
  }
}

async function scanFiles(item) {
  if (viewable(item)) {
    assets.push(item);
    document.title = `${assets.length} images`;
  }

  if (item.isDirectory) {
    return new Promise(resolve => {
      item.createReader().readEntries(async entries => {
        Promise.all(entries.map(async entry => await scanFiles(entry))).then(
          resolve
        );
      });
    });
  }
}

root.addEventListener('dragover', event => event.preventDefault(), false);

filePicker.onchange = () => {
  Array.from(event.target.files).forEach(file => assets.push(file));
  sort();
  show();
};

let cursorTimer = null;

function showCursor() {
  root.classList.remove('no-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    root.classList.add('no-cursor');
  }, 3000);
}

root.addEventListener('mousemove', showCursor);

root.addEventListener(
  'drop',
  async event => {
    event.preventDefault();

    const items = Array.from(event.dataTransfer.items);
    await Promise.all(
      items.map(item => item.webkitGetAsEntry()).map(item => {
        if (item) {
          return scanFiles(item);
        }
      })
    );

    sort();
    next();
  },
  false
);

async function next() {
  index++;
  if (index === assets.length) index = 0;
  show();

  if (assets[index + 1]) {
    const { img } = await load(assets[index + 1], new Image());
    nextImage = img;
  } else {
    nextImage = null;
  }
}

async function prev() {
  if (index === 0) index = assets.length;
  index--;
  nextImage = null;
  show();
}

function sort() {
  assets.sort((a, b) => {
    return a.name < b.name ? -1 : 1;
  });
}

root.addEventListener('dblclick', toggleFullScreen, false);
root.addEventListener('click', next, false);

root.addEventListener('keydown', async e => {
  const item = assets[index];
  // 0-9 numeric
  if (e.keyCode >= 48 && e.keyCode <= 57) {
    jumpTo.push(e.keyCode - 48);
    document.title = `Goto ${jumpTo.join('')}`;
    return;
  }

  // enter
  if (e.keyCode === 13 && jumpTo.length > 0) {
    index = parseInt(jumpTo.join(''), 10) - 2;
    nextImage = null;
    next();
  }

  // all other keys reset the numeric search (including enter)
  jumpTo.length = 0;

  // left cursor
  if (e.keyCode === 37) {
    return prev();
  }

  // right cursor
  if (e.keyCode === 39) {
    return next();
  }

  // f = toggle fullscreen
  if (e.keyCode === 70) {
    return toggleFullScreen();
  }

  // s = star
  if (e.keyCode === 83) {
    // if in list, remove
    if (starred.has(item)) {
      starred.remove(item);
      viewer.dataset.filename = viewer.dataset.filename.slice(0, -2);
    } else {
      starred.add(item);
      viewer.dataset.filename += ' ⭐️';
    }
  }

  // d = download
  if (e.keyCode === 68) {
    if (starred.size > 0) {
      // download a zip file
      await Promise.all(
        Array.from(starred).map(item => {
          let p = Promise.resolve(item);
          if (typeof item.file === 'function') {
            p = new Promise(resolve => item.file(resolve));
          }
          return p.then(file => zip.file(file.name, file));
        })
      );

      const scrBlob = new Blob([await zip.generateAsync({ type: 'blob' })], {
        'content-type': 'application/binary',
      });
      const url = URL.createObjectURL(scrBlob);
      const a = document.createElement('a');
      a.download = 'photos.zip';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    item.file(file => {
      const scrBlob = new Blob([file], {
        'content-type': 'application/binary',
      });
      const url = URL.createObjectURL(scrBlob);

      const a = document.createElement('a');
      a.download = file.name;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // a = auto play
  if (e.keyCode === 65) {
    if (timer) {
      clearInterval(timer);
    } else {
      timer = setInterval(next, 2000);
    }
  }
});
